require('dotenv').config();
require('console-stamp')(console, 'HH:MM:ss.l');

const fs = require('fs');
const axios = require('axios');
const h2p = require('html2plaintext');

const base = process.env.FORUM_ADDRESS;
const forumToken = process.env.FORUM_TOKEN;

const discord = require('discord.js');
const client = new discord.Client();

const { WebClient } = require('@slack/client');
const slack = new WebClient(process.env.SLACK_TOKEN);

client.login(process.env.DISCORD_TOKEN);

let latestPosts = [];
let storedPosts = [];

fs.openSync('latest-posts.json', 'r', (err, data) => {
	if (err) {
		if (err.code === 'ENOENT') {
			console.warn('latest-posts.json does not exist, creating');
			fs.writeFileSync('latest-posts.json', '');
			return;
		}

		throw err;
	}
});

latestPosts = require('./latest-posts.json');

if (latestPosts) {
	console.log('Loading latest-posts.json');
	
	latestPosts.forEach((post) => {
		storedPosts.push(post.id);
	});
}

client.setInterval(() => {

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

			// store the latest posts in memory and file
			let latestPosts = res.data.results;
			fs.writeFileSync('latest-posts.json', JSON.stringify(latestPosts));

			// if somehow there are no stored posts...
			if (storedPosts.length === 0) {

				console.log('No posts stored - storing latest posts');

				// ...store each new post's id
				latestPosts.forEach((post) => {
					storedPosts.push(post.id);
				});

			// else check stored posts for any new ones
			} else {

				console.log('Stored posts found - checking for new posts');

				// initialise newPosts array
				let newPosts = [];

				// loop through latestPosts and store into newPosts if not in storedPosts
				latestPosts.forEach((post) => {
					if (!storedPosts.includes(post.id)) {
						newPosts.push(post);
					}
				});

				// wipe storedPosts and build it with latest posts
				storedPosts = [];

				latestPosts.forEach((post) => {
					storedPosts.push(post.id);
				});

				console.log(`New posts: ${newPosts.length}`);

				// send new posts to discord and slack
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
	
}, 10000);
