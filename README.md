# User Manual

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Project Testing


### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.


## Project Building & Deployment

### Prerequisites

* **npm:** version `10.8.2` or higher

---

```bash
npm install
```

Install necessary dependencies
```bash
npm run build
```

Builds the app for production to the `build` folder.

```bash
firebase deploy
```

Hosts web page on the firebase according to the `build` folder we created in the previous step. \
Open `http://your_project_name.web.app/` to visit your website.


## How to Operate the Web 

### Account & Profile
+ Sign Up / Sign In - Use the main login page to register with an email/password, or use the `Sign in With Google` button.

+ Profile Management(⚙️) - Click the gear icon`⚙️` on the top left of the side bar to change email, name, profile picture, phone number and address.

### Chat & Group Functions
+ Start a Private Chat - Click on any user in the left side bar to start a private chart.
+ Create Group Chat(➕) - Inside any chat room, click the `➕` to invite other members and create a new private group chat.

### Message & Media
+ Send Text - Type in the buttom input bar and press enter or click the "傳送" button.
+ Send Image(🖼️) - Click `🖼️` icon to upload and send photo from user's device.
+ Search and Send Gif(🎬) - Click `🎬` icon to open gif panel. You can browse trending gifs or use the search bar to find desired ones. Click on a gif to send.
+ Send Custom Stick(🖌️) - Click `🖌️` icon to start drawing. Chat room will be cover by canvas and you can choose different brush types and color. Click "送出" to send stick in the png format.
+ Search Message(🔍) - Click `🔍` to search for specific keywords in the current chat history.
+ Message Reactions(😀) - Click `😀` next to the message bubble to add an emoji reaction.

### Advanced / Bonus Features
+ Responsive Web Design - Shrink the windows size or use mobile view. This side bar will hide, a hamburger bar will appear, and the toolbar/emoji will automatically wrap to adapt the screen size without overflowing.
+ CSS Animation - Reload the page or switch between char rooms to see the CSS loading spinner animation, and send a message to see the message slide-up animation.