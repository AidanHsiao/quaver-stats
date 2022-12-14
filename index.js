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
  switch (msg.content) {
    case "!quaver": {
      msg.react("👍");
      const user = await getPlayerStats();
      const lines = `\`\`\`Global Peak [b]#${
        user.globalRank
      } (Top ${user.globalPercent.toFixed(3)}%)[/b]\nUSA Peak [b]#${
        user.countryRank
      } (Top ${user.countryPercent.toFixed(
        3
      )}%)[/b]\n\n[h2]➤ Stats[/h2]\nOverall Rating: [b]${
        user.performanceRating
      }[/b]\nOverall Accuracy: [b]${
        user.overallAccuracy
      }%[/b]\`\`\`Paste this into the showcase.`;
      const sentMessage = await msg.channel.send(lines);
      setTimeout(() => sentMessage.delete(), 10000);
      msg.delete();
      break;
    }
    case "!toggleranked": {
      const quaverDoc = db.collection("personal").doc("quaver");
      const currentStatus = (await quaverDoc.get()).data().rankedSongCheck;
      quaverDoc.update({ rankedSongCheck: !currentStatus });
      msg.channel.send(`Ranked song check set to ${!currentStatus}.`);
      break;
    }
  }
});

client.login(token);

cron.schedule("*/30 * * * * *", async () => {
  const channel = await client.channels.fetch("1005819350684532787");
  const quaverDoc = db.collection("personal").doc("quaver");
  const songAmount = await axios(
    "https://api.quavergame.com/v1/mapsets/ranked"
  ).then((resp) => resp.data.mapsets.length);
  const user = await getPlayerStats();
  const dbUser = (await quaverDoc.get()).data();
  const date = new Date();
  const secondsPassed = (Date.now() - dbUser.timestamp) / 1000;
  const dhms = [];
  for (let i = 3; i >= 0; i--) {
    const value = (secondsPassed % 60 ** (i + 1)) / 60 ** i;
    dhms.push(Math.floor(value));
  }
  const dhmsNames = "day|hour|minute|second".split("|");
  const dhmsText = dhms
    .map(
      (value, idx) =>
        `${idx === 3 ? "and" : ""} ${value} ${dhmsNames[idx]}${
          value !== 1 ? "s" : ""
        }`
    )
    .join(", ");
  console.log(user, dbUser);
  if (
    user.globalRank !== dbUser.globalRank &&
    Date.now() - (dbUser.timestamp || 0) > 3600000
  ) {
    const hours = (Date.now() - dbUser.timestamp) / 1000 / 60 / 60;
    const embed = new Discord.MessageEmbed()
      .setTitle(
        `You've ${
          user.globalRank > dbUser.globalRank ? "gone down." : "improved!"
        } (${((date.getHours() - 1) % 12) + 1}:${
          date.getMinutes() < 10 ? "0" : ""
        }${date.getMinutes()} ${date.getHours() >= 12 ? "PM" : "AM"})`
      )
      .setDescription(`Here are your stats over the last ${dhmsText}.`)
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
        },
        {
          name: "Global Percentile",
          value: `${dbUser.globalPercent.toFixed(
            3
          )}% -> ${user.globalPercent.toFixed(3)}%`,
          inline: true,
        }
      );
    channel.send(embed);
    user.timestamp = Date.now();
    user.rankedSongAmount = songAmount;
    user.rankedSongCheck = dbUser.rankedSongCheck;
    quaverDoc.set(user);
  }
  if (songAmount !== dbUser.rankedSongAmount && dbUser.rankedSongCheck) {
    channel.send(
      "<@302942608676880385> NEW RANKED SONG IS OUT TIME TO FARM\n`Use !toggleranked to disable me.`"
    );
    quaverDoc.update({ rankedSongAmount: songAmount });
  }
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
    performanceRating:
      Math.round(user.stats.overall_performance_rating * 100) / 100,
    overallAccuracy: Math.round(user.stats.overall_accuracy * 100) / 100,
  };
}
