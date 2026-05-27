export async function onRequest(context) {
  try {

    const signalData = {
      pair: "XAUUSD",
      signal: Math.random() > 0.5 ? "BUY" : "SELL",
      entry: "2350",
      tp: "2370",
      sl: "2340",
      confidence: "92%",
      time: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(signalData),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (err) {

    return new Response(
      JSON.stringify({
        error: err.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  }
}
