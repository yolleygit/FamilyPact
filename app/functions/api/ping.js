export async function onRequest(context) {
    return new Response(JSON.stringify({ pong: true, time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
