import { test, expect } from "bun:test";
import { verifyWebBotAuth } from "../src/web-bot-auth.ts";

const directory = async () =>
  new Response(
    JSON.stringify({
      keys: [
        {
          kty: "OKP",
          crv: "Ed25519",
          kid: "test-key",
          x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    }),
    { status: 200 },
  );

test("rejects missing Web Bot Auth fields", async () => {
  expect(
    (
      await verifyWebBotAuth({
        method: "GET",
        url: "https://example.com/",
        headers: {},
      })
    ).verified,
  ).toBe(false);
});

test("rejects a tampered signature", async () => {
  const result = await verifyWebBotAuth(
    {
      method: "GET",
      url: "https://example.com/",
      headers: {
        "signature-agent": "https://openai.com",
        "signature-input": 'sig1=("@method");created=1;keyid="test-key"',
      },
      signature: "sig1=:dGFtcGVyZWQ:",
      signatureInput: 'sig1=("@method");created=1;keyid="test-key"',
      signatureAgent: "https://openai.com",
    },
    undefined,
    directory,
  );
  expect(result.verified).toBe(false);
});
