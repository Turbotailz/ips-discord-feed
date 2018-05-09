require('dotenv').config();

const axios = require('axios');
const discord = require('discord.js');
const h2p = require('html2plaintext');
const moment = require('moment');

const base = 'https://forum.diversitymc.net/api/';
const forumToken = process.env.FORUM_TOKEN;

const client = new discord.Client();

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
	let storedPosts = [];

	setInterval(function(){
		axios.get(base + 'forums/posts', {
			params: {
				key: forumToken,
				sortDir: 'desc',
			}
		})
		.then((res) => {
			let latestPosts = res.data.results;

			if (storedPosts.length === 0) {
				latestPosts.forEach((post) => {
					storedPosts.push(post.id);
				});
			} else {
				let newPosts = [];

				latestPosts.forEach((post) => {
					if (!storedPosts.includes(post.id)) {
						newPosts.push(post);
					}
				});

				storedPosts = [];

				latestPosts.forEach((post) => {
					storedPosts.push(post.id);
				});

				newPosts.forEach((post) => {
					axios.get(base + 'forums/topics/' + post.item_id, {
						params: {
							key: forumToken
							}
						})
					.then(response => {
						let topic = response.data;
						if (topic.forum.id !== 4) {
							let embed = new discord.RichEmbed()
								.setAuthor(post.author.name, post.author.photoUrl)
								.setDescription(h2p(post.content))
								.setTimestamp(post.date)
								.setURL(post.url)
								.setTitle(topic.title)

							client.channels.get(process.env.DISCORD_CHANNEL).send(embed);
						}
					});
				});
			}
		})
		.catch(console.error);
	}, 60000);
});
