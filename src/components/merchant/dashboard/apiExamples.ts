/** One request (list products) in the languages merchants integrate from. */
export const API_EXAMPLES: Array<{ id: string; label: string; code: (url: string) => string }> = [
  {
    id: "curl",
    label: "cURL",
    code: (url) => `curl -X GET "${url}" \\
  -H "Authorization: Bearer mk_live_xxxxx" \\
  -H "Content-Type: application/json"`,
  },
  {
    id: "javascript",
    label: "JavaScript",
    code: (url) => `const response = await fetch("${url}", {
  headers: {
    Authorization: "Bearer mk_live_xxxxx",
    "Content-Type": "application/json",
  },
});
if (!response.ok) throw new Error("Request failed: " + response.status);
const products = await response.json();`,
  },
  {
    id: "python",
    label: "Python",
    code: (url) => `import requests

response = requests.get(
    "${url}",
    headers={
        "Authorization": "Bearer mk_live_xxxxx",
        "Content-Type": "application/json",
    },
    timeout=30,
)
response.raise_for_status()
products = response.json()`,
  },
  {
    id: "php",
    label: "PHP",
    code: (url) => `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer mk_live_xxxxx",
        "Content-Type: application/json",
    ],
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status !== 200) {
    throw new Exception("Request failed: " . $status);
}
$products = json_decode($body, true);`,
  },
  {
    id: "csharp",
    label: "C#",
    code: (url) => `using System.Net.Http.Headers;

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", "mk_live_xxxxx");

var response = await client.GetAsync("${url}");
response.EnsureSuccessStatusCode();
var products = await response.Content.ReadAsStringAsync();`,
  },
  {
    id: "java",
    label: "Java",
    code: (url) => `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${url}"))
    .header("Authorization", "Bearer mk_live_xxxxx")
    .header("Content-Type", "application/json")
    .GET()
    .build();

HttpResponse<String> response =
    client.send(request, HttpResponse.BodyHandlers.ofString());
String products = response.body();`,
  },
];
