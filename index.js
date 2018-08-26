require('dotenv').config();

const axios = require('axios');
const discord = require('discord.js');
const h2p = require('html2plaintext');
const moment = require('moment');
const { WebClient } = require('@slack/client');
require('console-stamp')(console, '[HH:MM:ss.l]');

const base = 'https://forum.diversitymc.net/api/';
const forumToken = process.env.FORUM_TOKEN;

const client = new discord.Client();
const slack = new WebClient(process.env.SLACK_TOKEN);

const ms = require('./minestat.js');

client.login(process.env.DISCORD_TOKEN);

process.on('uncaughtException', (exception) => {
	console.log(exception);
});

process.on('unhandledRejection', (reason, p) => {
	console.log(`Unhandled promise at ${p}, reason: ${reason}`);
});

client.on('ready', () => {
	let storedPosts = [];
	let playersOnline = 0;

	setInterval(function(){
		console.log('--------------------------');
		console.log('Fetching posts');
		axios.get(base + 'forums/posts', {
			params: {
				key: forumToken,
				sortDir: 'desc',
			}
		})
		.then((res) => {
			console.log('Response received...');
			if (res.status == 404) { 
				console.log('Error 404');
			} else {
			let latestPosts = res.data.results;

			if (storedPosts.length === 0) {
				console.log('No posts stored - storing latest posts');
				latestPosts.forEach((post) => {
					storedPosts.push(post.id);
				});
			} else {
				console.log('Stored posts found - checking for new posts');
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
				console.log(`New posts: ${newPosts.length}`);
				if (newPosts.length > 0) {
				console.log('Fetching topics for each new post');
				newPosts.forEach((post) => {
					axios.get(base + 'forums/topics/' + post.item_id, {
						params: {
							key: forumToken
							}
						})
					.then((response) => {
						if (response.status == 404) {
							console.log('Error 404');
							return;
						}

						let topic = response.data;
						if (topic.forum.id !== 4) {
							let embed = new discord.RichEmbed()
								.setAuthor(post.author.name, post.author.photoUrl)
								.setDescription(h2p(post.content).substring(0,2040))
								.setTimestamp(post.date)
								.setURL(post.url)
								.setTitle(topic.title)

							console.log('Send new post to Discord');
							client.channels.get(process.env.DISCORD_CHANNEL).send(embed);
						}
						if (topic.forum.id == 5) {
							slack.chat.postMessage({
								channel: process.env.SLACK_CHANNEL,
								attachments: [
									{
										"author_name": post.author.name,
										"author_icon": post.author.photoUrl,
										"title": topic.title,
										"title_link": post.url,
										"text": h2p(post.content),
										"ts": new Date(post.date).getTime() / 1000
									}
								],
								as_user: false,
								username: 'Janitor',
								icon_url: 'https://i.imgur.com/QH8tWti.png'
							})
							.then((slackRes) => { console.log('Ban appeal message sent to Slack',slackRes.ts) })
							.catch((err) => { console.log('Error posting to Slack')});
						}
					})
					.catch((error) => { console.log('Error connecting to IP Board API - Topics'); });
				});
				}
			}
			}
		})
		.catch((error) => {
			if (error.response) {
				console.log(error.response.data);
			} else if (error.request) {
				console.log(error.request);
			} else {
				console.log('Error', error.message);
			}
			console.log('Error connecting to IP Board API - Posts');
		});

		ms.init('play.diversitymc.net', 25565, (result) => {
			playersOnline = ms.current_players;
			console.log(`Players online: ${playersOnline}`);

			if (ms.online) {
				if (playersOnline > 0) {
					client.user.setActivity(playersOnline + ' players online', {type: 'PLAYING'})
						.then()
						.catch(console.error);
					client.user.setStatus('online').then().catch(console.error);
				} else {
					client.user.setActivity('No one online ☹️', {type: 'PLAYING'})
						.then()
						.catch(console.error);
					client.user.setStatus('idle').then().catch(console.error);
				}
			} else {
				client.user.setActivity('Offline 🛑', {type: 'PLAYING'})
					.then()
					.catch(console.error);
				client.user.setStatus('dnd').then().catch(console.error);
			}
		});
	}, 60000);
});
