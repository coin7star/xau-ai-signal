#property strict
#property version   "1.3"
#property description "Send MT5 candle data to Cloudflare API then Firebase"

input string API_URL = "https://xau-ai-signal.pages.dev/api/market";
input string TOKEN   = "ISI_TOKEN_SAMA_DENGAN_ENV";
input string SYMBOL_NAME = "";
input ENUM_TIMEFRAMES TIMEFRAME = PERIOD_M1;
input int CANDLE_LIMIT = 50;
input int SEND_INTERVAL_SECONDS = 10;

datetime lastSend = 0;

string TimeframeToString(ENUM_TIMEFRAMES tf){switch(tf){case PERIOD_M1:return "M1";case PERIOD_M2:return "M2";case PERIOD_M5:return "M5";case PERIOD_M15:return "M15";case PERIOD_M30:return "M30";case PERIOD_H1:return "H1";case PERIOD_H4:return "H4";case PERIOD_D1:return "D1";default:return "M1";}}
string JsonEscape(string value){StringReplace(value,"\\","\\\\");StringReplace(value,"\"","\\\"");StringReplace(value,"\r","\\r");StringReplace(value,"\n","\\n");return value;}
string GetActiveSymbol(){string symbol=SYMBOL_NAME;if(symbol=="")symbol=_Symbol;SymbolSelect(symbol,true);return symbol;}

int OnInit(){Print("XAU Web Data Sender Firebase aktif");Print("Symbol aktif: ",GetActiveSymbol());Print("Timeframe: ",TimeframeToString(TIMEFRAME));EventSetTimer(SEND_INTERVAL_SECONDS);return(INIT_SUCCEEDED);}
void OnDeinit(const int reason){EventKillTimer();}
void OnTimer(){if(TimeCurrent()-lastSend<SEND_INTERVAL_SECONDS)return;lastSend=TimeCurrent();SendMarketData();}

void SendMarketData()
{
   string symbol=GetActiveSymbol();
   MqlRates rates[];
   ArraySetAsSeries(rates,true);
   int limit=CANDLE_LIMIT;
   if(limit<5)limit=5;
   if(limit>300)limit=300;

   ResetLastError();
   int copied=CopyRates(symbol,TIMEFRAME,0,limit,rates);
   if(copied<=0){Print("Gagal ambil candle: ",GetLastError()," | Symbol: ",symbol);return;}

   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   if(digits<2)digits=2;
   if(digits>5)digits=5;

   double bid=SymbolInfoDouble(symbol,SYMBOL_BID);
   double ask=SymbolInfoDouble(symbol,SYMBOL_ASK);

   string candles="[";
   for(int i=copied-1;i>=0;i--)
   {
      candles+="{";
      candles+="\"time\":\""+TimeToString(rates[i].time,TIME_DATE|TIME_SECONDS)+"\",";
      candles+="\"open\":"+DoubleToString(rates[i].open,digits)+",";
      candles+="\"high\":"+DoubleToString(rates[i].high,digits)+",";
      candles+="\"low\":"+DoubleToString(rates[i].low,digits)+",";
      candles+="\"close\":"+DoubleToString(rates[i].close,digits)+",";
      candles+="\"volume\":"+IntegerToString((int)rates[i].tick_volume);
      candles+="}";
      if(i>0)candles+=",";
   }
   candles+="]";

   string body="{";
   body+="\"token\":\""+JsonEscape(TOKEN)+"\",";
   body+="\"symbol\":\""+JsonEscape(symbol)+"\",";
   body+="\"timeframe\":\""+TimeframeToString(TIMEFRAME)+"\",";
   body+="\"serverTime\":\""+TimeToString(TimeCurrent(),TIME_DATE|TIME_SECONDS)+"\",";
   body+="\"bid\":"+DoubleToString(bid,digits)+",";
   body+="\"ask\":"+DoubleToString(ask,digits)+",";
   body+="\"digits\":"+IntegerToString(digits)+",";
   body+="\"candles\":"+candles;
   body+="}";

   uchar data[];
   int dataSize=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8);
   if(dataSize>0)ArrayResize(data,dataSize-1);

   uchar result[];
   string responseHeaders;
   string headers="Content-Type: application/json\r\n";

   ResetLastError();
   int responseCode=WebRequest("POST",API_URL,headers,10000,data,result,responseHeaders);
   if(responseCode==-1){Print("WebRequest gagal: ",GetLastError());Print("Allow URL: https://xau-ai-signal.pages.dev");return;}

   string response=CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8);
   Print("Market data terkirim | HTTP: ",responseCode," | Symbol: ",symbol," | Candle: ",copied);
   Print("Response: ",response);
}
