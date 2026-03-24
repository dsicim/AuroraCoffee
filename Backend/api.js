async function handleAPI(method, endpoint, body) {
    console.log(`API Request: ${method} ${endpoint} with body: ${JSON.stringify(body)}`);
    return {s:400, j:true, d:{m:"Not Found"}, h: {"x-api-check":"true"}};
}
module.exports = { handleAPI };