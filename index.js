const admin = require("firebase-admin");

const Discord = require("discord.js");
const cron = require("node-cron");
require("dotenv").config();
const axios = require("axios");
const client = new Discord.Client();
const token = process.env.DISCORD_TOKEN;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

client.on("ready", () => console.log("Bot Ready!"));

client.on("message", async (msg) => {
  if (msg.author.bot) return;
  if (msg.content === "!quaver") {
    msg.react("👍");
    const user = await getPlayerStats();
    const lines = `\`\`\`Global Peak [b]#${
      user.globalRank
    } (Top ${user.globalPercent.toFixed(3)}%)[/b]\nUSA Peak [b]#${
      user.countryRank
    } (Top ${user.countryPercent.toFixed(
      3
    )}%)[/b]\`\`\`Paste this into the showcase.`;
    const sentMessage = await msg.channel.send(lines);
    setTimeout(() => sentMessage.delete(), 10000);
    msg.delete();
  }
});

client.login(token);

cron.schedule("*/10 * * * * *", async () => {
  const channel = await client.channels.fetch("1005819350684532787");
  const quaverDoc = db.collection("personal").doc("quaver");
  const songAmount = await axios(
    "https://api.quavergame.com/v1/mapsets/ranked"
  ).then((resp) => resp.data.mapsets.length);
  const user = await getPlayerStats();
  const dbUser = (await quaverDoc.get()).data();
  const date = new Date();
  if (
    user.globalRank !== dbUser.globalRank &&
    dbUser.timestamp - user.timestamp > 3600000
  ) {
    const embed = new Discord.MessageEmbed()
      .setTitle(
        `You've improved! (${((date.getHours() - 1) % 12) + 1}:${
          date.getMinutes() < 10 ? "0" : ""
        }${date.getMinutes()} ${date.getHours >= 12 ? "PM" : "AM"})`
      )
      .setDescription(
        `Here are your stats over the last ${
          (Date.now() - dbUser.timestamp) / 1000 / 60 / 60
        } hours.`
      )
      .setColor("#aa00ff")
      .setFooter("Bot built by Aidan Hsiao.")
      .addFields(
        {
          name: "Global Rank",
          value: `#${dbUser.globalRank} -> #${user.globalRank}`,
          inline: true,
        },
        {
          name: "Country Rank",
          value: `#${dbUser.countryRank} -> #${user.countryRank}`,
          inline: true,
        }
      );
    channel.send(embed);
  }
  user.rankedSongAmount = songAmount;
  user.timestamp = Date.now();
  quaverDoc.set(user);
});

async function getPlayerStats() {
  const userCount = await axios("https://api.quavergame.com/v1/stats").then(
    (resp) => resp.data.stats.total_users
  );
  const countryCount = await axios(
    "https://api.quavergame.com/v1/stats/country"
  ).then((resp) => resp.data.countries.us);
  const user = await axios(
    "https://api.quavergame.com/v1/users/full/332660"
  ).then((resp) => resp.data.user.keys4);
  return {
    globalRank: user.globalRank,
    countryRank: user.countryRank,
    globalPercent: (user.globalRank / userCount) * 100,
    countryPercent: (user.countryRank / countryCount) * 100,
  };
}
