# Previous Projects

The covered projects includes:

- **Node.js** Messenger Chatbot 
- **Python** Instagram Followers Scraper
- **React APP** Interactive Quiz/Survey

The descriptions for each project are listed as below:


## Messenger Chatbot

- Written in Node.js and Express framework. 
- Able to activate welcome message upon interaction (GET STARTED) and persistent menu
- Message is available in any form that messenger supports (Carosel, Cards, Image, buttons, quick replies)
- Auto-reply is based on certain keyword or payload
- The payload is governed by the CustomRules (set within the js file) and ScriptRules (attached as JSON file and recorded in script.json)
- This chatbot is also able to call API from other apps (e.g: google) for other functions such as: get directions, live scores, flight deals...etc
- NLP is **NOT** supported, this chatbot only reply according to the condition set by user

## Instagram Scrapper

- Written in python
- It scraps the followers or following of a **non-private** instagram user
- Other functions as well for example -> Execute like on photo, follow user, commenting and find connection.
- Mostly utilised Selenium module for a webdriver provider
- Need to provide 3 pieces of information -> your valid instagram account **username** and **password**, your target's **username**
- Able to extract a user's ID, user_handle, is_private boolean value, is_verified boolean value, profile pic url and Full Name.
- To swap the mode between extracting followers & following, change the mode in the function defined below
```js
scrapeFollowersFromAnAccount(mode="followers") 
scrapeFollowersFromAnAccount(mode="following")

// Every executional lines is placed under 
if __name__ == "__main__":
```
- Two main python executional files -> script.py (executional) and API.py (contains all def functions)

### Interactive Quiz/Survey

- Written in Create React App by Facebook.
- Questions are set with multiple predefined answer choices
- The corresponding results are displayed after all the questions are answered. 
- Those choices are set in the **quizQuestion.js** file
- Once user answered all the questions, a function in **App.js** called **getResults()** will be called.
- That function generates an array called **answersCountKeys** where it contains all the chosen answer type.
- The displayed result is controlled by several **if-else** conditions found in **Results.js**.
- If the **answersCountKeys** contains a certain keyword(answer type defined in **quizQuestion.js**), it will display a div containing certain texts.

