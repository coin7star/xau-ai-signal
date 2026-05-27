#property strict
#property description "XAU AI Signal Cloudflare Poller"

input string SignalUrl = "https://xau-ai-signal.pages.dev/api/signal";
input int RefreshSeconds = 60;

int OnInit()
{
   EventSetTimer(RefreshSeconds);
   Print("XAU AI Signal EA started. Allow WebRequest for: ", SignalUrl);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   char post[];
   char result[];
   string headers;
   ResetLastError();
   int code = WebRequest("GET", SignalUrl, "", 10000, post, result, headers);
   if(code == -1)
   {
      Print("WebRequest failed. Error: ", GetLastError());
      return;
   }
   string body = CharArrayToString(result);
   Print("XAU AI Signal response: ", body);
   Comment("XAU AI Signal\n", body);
}
