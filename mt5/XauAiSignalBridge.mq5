#property strict
#property version   "1.00"
#property description "Bridge MT5 ke Cloudflare Worker untuk XAU AI Signal GenZ"

input string ApiBaseUrl = "https://xau-ai-signal-genz.username.workers.dev";
input string AppSecret = "ganti_secret_sama_dengan_cloudflare";
input string TradeSymbol = "XAUUSD";
input ENUM_TIMEFRAMES SignalTimeframe = PERIOD_M5;
input int SendEverySeconds = 60;
input int RsiPeriod = 14;
input int AtrPeriod = 14;
input int EmaFastPeriod = 21;
input int EmaSlowPeriod = 50;

datetime lastSent = 0;
int rsiHandle;
int atrHandle;
int emaFastHandle;
int emaSlowHandle;

int OnInit()
{
   rsiHandle = iRSI(TradeSymbol, SignalTimeframe, RsiPeriod, PRICE_CLOSE);
   atrHandle = iATR(TradeSymbol, SignalTimeframe, AtrPeriod);
   emaFastHandle = iMA(TradeSymbol, SignalTimeframe, EmaFastPeriod, 0, MODE_EMA, PRICE_CLOSE);
   emaSlowHandle = iMA(TradeSymbol, SignalTimeframe, EmaSlowPeriod, 0, MODE_EMA, PRICE_CLOSE);

   if(rsiHandle == INVALID_HANDLE || atrHandle == INVALID_HANDLE || emaFastHandle == INVALID_HANDLE || emaSlowHandle == INVALID_HANDLE)
   {
      Print("Gagal membuat handle indikator. Pastikan symbol tersedia: ", TradeSymbol);
      return INIT_FAILED;
   }

   EventSetTimer(SendEverySeconds);
   Print("XAU AI Signal Bridge aktif. Jangan lupa allow WebRequest URL: ", ApiBaseUrl);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   IndicatorRelease(rsiHandle);
   IndicatorRelease(atrHandle);
   IndicatorRelease(emaFastHandle);
   IndicatorRelease(emaSlowHandle);
}

void OnTimer()
{
   SendSnapshot();
}

void OnTick()
{
   if(TimeCurrent() - lastSent >= SendEverySeconds)
      SendSnapshot();
}

double ReadBuffer(int handle)
{
   double data[];
   ArraySetAsSeries(data, true);
   if(CopyBuffer(handle, 0, 0, 1, data) <= 0)
      return 0.0;
   return data[0];
}

string TfToString(ENUM_TIMEFRAMES tf)
{
   if(tf == PERIOD_M1) return "M1";
   if(tf == PERIOD_M5) return "M5";
   if(tf == PERIOD_M15) return "M15";
   if(tf == PERIOD_M30) return "M30";
   if(tf == PERIOD_H1) return "H1";
   if(tf == PERIOD_H4) return "H4";
   if(tf == PERIOD_D1) return "D1";
   return "TF";
}

string JsonEscape(string text)
{
   StringReplace(text, "\\", "\\\\");
   StringReplace(text, "\"", "\\\"");
   return text;
}

void SendSnapshot()
{
   MqlTick tick;
   if(!SymbolInfoTick(TradeSymbol, tick))
   {
      Print("Gagal baca tick: ", TradeSymbol);
      return;
   }

   double point = SymbolInfoDouble(TradeSymbol, SYMBOL_POINT);
   double spreadPoints = point > 0 ? (tick.ask - tick.bid) / point : 0;

   double rsi = ReadBuffer(rsiHandle);
   double atr = ReadBuffer(atrHandle);
   double emaFast = ReadBuffer(emaFastHandle);
   double emaSlow = ReadBuffer(emaSlowHandle);

   string trend = "flat";
   if(emaFast > emaSlow) trend = "bullish";
   if(emaFast < emaSlow) trend = "bearish";

   string body = "{";
   body += "\"symbol\":\"" + JsonEscape(TradeSymbol) + "\",";
   body += "\"timeframe\":\"" + TfToString(SignalTimeframe) + "\",";
   body += "\"bid\":" + DoubleToString(tick.bid, 3) + ",";
   body += "\"ask\":" + DoubleToString(tick.ask, 3) + ",";
   body += "\"rsi\":" + DoubleToString(rsi, 2) + ",";
   body += "\"atr\":" + DoubleToString(atr, 3) + ",";
   body += "\"emaFast\":" + DoubleToString(emaFast, 3) + ",";
   body += "\"emaSlow\":" + DoubleToString(emaSlow, 3) + ",";
   body += "\"spreadPoints\":" + DoubleToString(spreadPoints, 1) + ",";
   body += "\"candleTrend\":\"" + trend + "\",";
   body += "\"note\":\"MT5 MetaEditor bridge\"";
   body += "}";

   string url = ApiBaseUrl + "/api/mt5/tick";
   string headers = "Content-Type: application/json\r\nx-app-secret: " + AppSecret + "\r\n";

   char post[];
   char result[];
   string resultHeaders;
   StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);

   ResetLastError();
   int status = WebRequest("POST", url, headers, 15000, post, result, resultHeaders);

   if(status == -1)
   {
      int err = GetLastError();
      Print("WebRequest gagal. Error: ", err, ". Tambahkan URL ke Tools > Options > Expert Advisors > Allow WebRequest.");
      return;
   }

   string response = CharArrayToString(result, 0, -1, CP_UTF8);
   Print("Signal API status=", status, " response=", response);
   lastSent = TimeCurrent();
}
