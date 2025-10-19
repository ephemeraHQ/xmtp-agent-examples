import { Agent } from "@xmtp/agent-sdk";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

// Simple English-Spanish dictionary
const translations: Record<string, string> = {
  // Common words
  hello: "hola",
  goodbye: "adiós",
  please: "por favor",
  thank: "gracias",
  yes: "sí",
  no: "no",
  water: "agua",
  food: "comida",
  house: "casa",
  car: "coche",
  book: "libro",
  cat: "gato",
  dog: "perro",
  bird: "pájaro",
  tree: "árbol",
  flower: "flor",
  sun: "sol",
  moon: "luna",
  star: "estrella",
  friend: "amigo",
  family: "familia",
  love: "amor",
  happy: "feliz",
  sad: "triste",
  big: "grande",
  small: "pequeño",
  good: "bueno",
  bad: "malo",
  hot: "caliente",
  cold: "frío",
  fast: "rápido",
  slow: "lento",
  beautiful: "hermoso",
  ugly: "feo",
  easy: "fácil",
  difficult: "difícil",
  new: "nuevo",
  old: "viejo",
  young: "joven",
  red: "rojo",
  blue: "azul",
  green: "verde",
  yellow: "amarillo",
  black: "negro",
  white: "blanco",
  one: "uno",
  two: "dos",
  three: "tres",
  four: "cuatro",
  five: "cinco",
  six: "seis",
  seven: "siete",
  eight: "ocho",
  nine: "nueve",
  ten: "diez",
  // Time-related
  today: "hoy",
  tomorrow: "mañana",
  yesterday: "ayer",
  morning: "mañana",
  afternoon: "tarde",
  evening: "noche",
  night: "noche",
  week: "semana",
  month: "mes",
  year: "año",
  // Common verbs
  eat: "comer",
  drink: "beber",
  sleep: "dormir",
  walk: "caminar",
  run: "correr",
  talk: "hablar",
  listen: "escuchar",
  see: "ver",
  hear: "oír",
  think: "pensar",
  know: "saber",
  understand: "entender",
  learn: "aprender",
  teach: "enseñar",
  work: "trabajar",
  play: "jugar",
  read: "leer",
  write: "escribir",
  // Places
  school: "escuela",
  hospital: "hospital",
  restaurant: "restaurante",
  store: "tienda",
  park: "parque",
  beach: "playa",
  mountain: "montaña",
  city: "ciudad",
  country: "país",
  // Technology
  computer: "computadora",
  phone: "teléfono",
  internet: "internet",
  email: "correo electrónico",
  website: "sitio web",
  app: "aplicación",
  // Actions
  help: "ayudar",
  buy: "comprar",
  sell: "vender",
  give: "dar",
  take: "tomar",
  come: "venir",
  go: "ir",
  stay: "quedarse",
  leave: "salir",
  open: "abrir",
  close: "cerrar",
  start: "empezar",
  stop: "parar",
  finish: "terminar",
  // Feelings
  tired: "cansado",
  excited: "emocionado",
  nervous: "nervioso",
  calm: "tranquilo",
  angry: "enojado",
  surprised: "sorprendido",
  worried: "preocupado",
  confident: "confiado",
};

function translateToSpanish(word: string): string | null {
  const cleanWord = word.toLowerCase().trim();
  return translations[cleanWord] || null;
}

const agent = await Agent.create(
  createSigner(createUser(process.env.XMTP_WALLET_KEY as `0x${string}`)),
  {
    env: process.env.XMTP_ENV as "local" | "dev" | "production",
  },
);

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content.trim();
  console.log("Translation request received:", messageContent);

  try {
    // Handle multiple words
    const words = messageContent.split(/\s+/);
    const translations: string[] = [];
    const unknownWords: string[] = [];

    for (const word of words) {
      const translation = translateToSpanish(word);
      if (translation) {
        translations.push(`${word} → ${translation}`);
      } else {
        unknownWords.push(word);
      }
    }

    if (translations.length > 0) {
      let response = "🇪🇸 **Spanish Translations:**\n\n";
      response += translations.join("\n");

      if (unknownWords.length > 0) {
        response += `\n\n❓ **Words not found:** ${unknownWords.join(", ")}`;
        response += "\n\n💡 *Try sending individual words or check spelling.*";
      }

      await ctx.sendText(response);
    } else {
      await ctx.sendText(
        `❓ I couldn't find translations for: "${unknownWords.join(", ")}"\n\n` +
          "💡 *Try sending individual English words. I know common vocabulary like: hello, water, cat, book, etc.*",
      );
    }
  } catch (error) {
    console.error("Error processing translation:", error);
    await ctx.sendText(
      "❌ Sorry, I encountered an error processing your request. Please try again!",
    );
  }
});

agent.on("start", () => {
  console.log(`🌍 Spanish Translation Agent is running...`);
  console.log(`📍 Address: ${agent.address}`);
  console.log(`🔗 ${getTestUrl(agent.client)}`);
  console.log(`💬 Send me English words to translate to Spanish!`);
});

await agent.start();
