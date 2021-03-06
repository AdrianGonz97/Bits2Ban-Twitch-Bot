# Bits2Ban-Twitch-Bot
## About
The Bits2Ban Twitch Bot is a fun, interactive bot that [Twitch](https://www.twitch.tv/) broadcasters can add to their channel to increase chat chaos. The main purpose of this bot is to allow viewers to ban **anyone** they want, including moderators, in exchange for a specified amount of bits. Once a ban request is triggered, the bot will then send a message in chat, asking the soon-to-be banned viewer if they have any final words. During their final words, users will be able to avoid their ban by cheering the target amount of bits, handing the ban right back to the user that gave it to them. After their time runs out, the viewer is then timed out for a given amount of time, specified by the broadcaster.

### Features
- Viewers are able to ban each other for a set amount of time for a given amount of bits.
- Viewers can avoid being banned by cheering the target amount of bits before the 25 second ban delay runs out. If done, the ban is handed right back to the user that first requested the ban. Both users will have an opportunity to counter ban each other over and over again.
- Moderators can also be banned. Once their timeout has expired, their moderator role will automatically be granted back to them.
- Settings are customizable with commands from the broadcaster's chat. Broadcasters can adjust the amount of time a user is banned for, the amount of bits required to trigger a ban, and the timeout message that is sent when a user is banned.

## Usage
### Banning a User
To ban a user, a viewer must **CHEER** the exact amount of bits that was set by the broadcaster and they must `@` the user they want to ban. 

For example, let's say I want to ban `twitchgaming` from a stream utilizing this app. If the cost in bits to ban someone is 2000, I would have to submit the following in chat:

    cheer1000 cheer500 see ya later nerd @twitchgaming cheer500
    
As you can see, it does not matter where the user has been tagged in the message. The only things that matter are:
- A user has been tagged 
- The total amount of bits redeemed is exact to the amount required

If multiple users were tagged in the same message, the ban will be issued to the user that was tagged first.

### Avoiding a Ban (Counter Banning)
A user can avoid being banned by **CHEER**ing the exact amount of bits that was set by the broadcaster during the "final words" stage. If a user **CHEERS** in time, the original ban requester will now be the one that is set to be banned. They will have an oppurtunity to counter ban the original counter ban, and can theoretically result in an infinite loop of two users going back and forth to avoid being banned. Excellent.

With each subsequent counter ban, the timeout time multiplies by the amount of back and forth occurs. For example, if the timeout time is set to 100 seconds, and the two users ping pong the counter ban 5 times, the user that receives the ban will be timed out for 500 seconds.

## Commands to Adjust Settings:
#### IMPORTANT NOTE:
Only the broadcaster that has signed into the app can use these commands to adjust their settings. If you have not modified the source code at all, my personal twitch account also has access to adjust these settings.

#### Default Settings:
| Setting         | Value           |
| -------         | -----           |
| Timeout Message | `was banned by` |
| Bit Cost        | `2000` bits     |
| Timeout Time    | `609` seconds   |

### Adjusting Timeout Message:
To adjust the message that is sent after the user has been banned, use the following command in the chat of the broadcaster:

    !b2b msg [content]

The default message is `was banned by`. The resulting message of a user being banned would appear as the following: 

`@BannedUser was banned by @BanRequester`

### Adjusting Bits Cost:
To adjust the amount of bits required to trigger a ban, use the following command in the chat of the broadcaster:

    !b2b cost [amount]

The default bit amount is `2000` bits. The input range is from [0 - 1000000]. Setting this property to 0 can act as a temporary disabling of ban triggers as it is impossible to cheer 0 bits.

### Adjusting Timeout Time:
To adjust the amount of time (unit is in seconds) that a user is timed out for, use the following command in the chat of the broadcaster:

    !b2b time [amount]
    
The default timeout time is `609` seconds. The input range is from [1 - 1209600]. The max amount is Twitch's longest possible timeout time, which is 2 weeks.

## Installation
#### NOTE:
To follow this guide, first complete **Common Guide** section. Once done, you can move onto either the **Node** or **Docker** section, depending on which method you choose to run the application. Finally, the **Final Touches** section shows you how to connect your bot to your Twitch account. The total installation process should take less than 30 minutes to complete.

### Requirements:
- [Twitch Dev Application](https://dev.twitch.tv/console/apps) - This is where you will acquire your API credentials after registration.
- [Node.js v16](https://nodejs.org/) - Ignore if you're running the app in a docker container.
- [Yarn](https://yarnpkg.com/) - Ignore if you're running the app in a docker container.
- (Optional) [Docker & Docker-Compose](https://www.docker.com/)

### Common Guide:
- Download the latest [RELEASE](https://github.com/AdrianGonz97/Bits2Ban-Twitch-Bot/releases).
- Unzip the RELEASE folder.
- Register a [Twitch Application](https://dev.twitch.tv/console/apps) to acquire your API credentials. You can temporarily add `http://localhost:3000` to OAuth Redirect URLs as a placeholder. Once registered, you will be able to access the Client ID and Client Secret.
- Modify and populate the `.env-example` file. 
  - If you're running this locally, set `PORT` to `3000` and the `URI` to `http://localhost:3000`.
  - Populate the `CLIENT_ID` and `CLIENT_SECRET` fields with their respective Twitch API credentials that you can find on your [Twitch Dev Console](https://dev.twitch.tv/console/apps) for your registered application.
  - Finally, **RENAME** the `.env-example` file to `.env`.
- While you're on the [Twitch Dev Console](https://dev.twitch.tv/console/apps) for your registered application, add 2 **OAuth Redirect URLs**.
  - If you're running locally, add `http://localhost:3000/login` and `http://localhost:3000/revoke`.
  - Otherwise, add your URI with the endpoints `/login` and `/revoke` appended to the back. For example, `https://example.com/login` and `https://example.com/revoke`.

### Node:
- Next, open a terminal and navigate back to the root directory of the project (this is the same directory where the `src` folder, `.env` file, and `Dockerfile` are located). 
- Run the following command: `yarn --prod`. This will install all of the necessary dependencies for the application.
- After the installation, run the following command: `yarn start:prod`. This will start the application.

### Docker:
- Next, open a terminal and navigate back to the root directory of the project (this is the same directory where the `src` folder, `.env` file, and `Dockerfile` are located). 
- Run the following command: `docker-compose build`
- After the image has been built, you can start the docker container by running the following: `docker-compose up`

### Final Touches:
- Once the app is running, navigate to your URI (if you're running locally, go to `http://localhost:3000`). 
- From there, you can sign in by clicking the `Connect` link on the page. 
- Once connected, the bot should be up and running. From here, you can adjust the settings of the bot using commands (found in the above **USAGE** section) in twitch chat of the broadcaster.
