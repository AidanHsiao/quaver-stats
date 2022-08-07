const { Client } = require("discord.js");
const axios = require("axios");
const client = new Client();
const token =
  "MTAwNTgwNDQ2MDIzNDI2MDYwMg.GhfK6-.iUyro4m3gnUC4SZEeOiOlTcmp3QzHbJ3RIn1Vk";

client.on("ready", () => console.log("Bot Ready!"));

client.on("message", async (msg) => {
  if (msg.content === "!quaver") {
    msg.react("👍");
    const userCount = await axios("https://api.quavergame.com/v1/stats").then(
      (resp) => resp.data.stats.total_users
    );
    const countryCount = await axios(
      "https://api.quavergame.com/v1/stats/country"
    ).then((resp) => resp.data.countries.us);
    const user = await axios(
      "https://api.quavergame.com/v1/users/full/332660"
    ).then((resp) => resp.data.user.keys4);
    const percentObject = {
      globalPercent: (user.globalRank / userCount) * 100,
      countryPercent: (user.countryRank / countryCount) * 100,
    };
    const lines = `\`\`\`Global Peak [b]#${
      user.globalRank
    } (Top ${percentObject.globalPercent.toFixed(3)}%)[/b]\nUSA Peak [b]#${
      user.countryRank
    } (Top ${percentObject.countryPercent.toFixed(
      3
    )}%)[/b]\`\`\`Paste this into the showcase.`;
    const sentMessage = await msg.channel.send(lines);
    setTimeout(() => sentMessage.delete(), 10000);
    msg.delete();
  }
});

client.login(token);
