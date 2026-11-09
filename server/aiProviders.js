import dns from "node:dns";
import net from "node:net";

export const AI_PROVIDERS = {
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
  },
  custom: {
    label: "Custom OpenAI compatible",
    baseUrl: "",
    model: "",
  },
};

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(address) {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (value.startsWith("fe80")) return true;
  if (value.startsWith("::ffff:")) return isPrivateIPv4(value.slice(7));
  if (value.startsWith("2001:db8")) return true;
  if (value.startsWith("ff")) return true;
  return false;
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

async function assertPublicHost(hostname) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    throw badRequest("The API host is not allowed.");
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw badRequest("The API host is not allowed.");
    }
    return;
  }

  let addresses;
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch {
    throw badRequest("The API host could not be resolved.");
  }

  if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) {
    throw badRequest("The API host is not allowed.");
  }
}

export async function resolveAiConfig({ provider, baseUrl, model }) {
  const key = AI_PROVIDERS[provider] ? provider : "groq";
  const preset = AI_PROVIDERS[key];
  const allowPrivate = process.env.ALLOW_PRIVATE_AI_URLS === "true";
  const resolvedBase =
    key === "custom" ? String(baseUrl || "").trim() : preset.baseUrl;
  const resolvedModel = String(model || "").trim() || preset.model;

  if (!resolvedBase) {
    throw badRequest("Enter the API base URL.");
  }
  if (!resolvedModel) {
    throw badRequest("Enter the model name.");
  }
  if (
    resolvedModel.length > 120 ||
    !/^[A-Za-z0-9._:/-]+$/.test(resolvedModel)
  ) {
    throw badRequest("Enter a valid model name.");
  }

  let url;
  try {
    url = new URL(resolvedBase);
  } catch {
    throw badRequest("Enter a valid API base URL.");
  }

  if (url.protocol !== "https:" && !allowPrivate) {
    throw badRequest("The API base URL must use HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw badRequest("Enter a valid API base URL.");
  }

  if (!allowPrivate) {
    await assertPublicHost(url.hostname);
  }

  return {
    provider: key,
    baseUrl: resolvedBase.replace(/\/+$/, ""),
    model: resolvedModel,
  };
}
