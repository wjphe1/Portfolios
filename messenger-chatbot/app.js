/*   
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

var customRules = {};
const
  bodyParser = require('body-parser'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request');

var fs = require('fs');

const _ = require('lodash');
const scriptRules = require('./script.json');
const jokes = require('./script/JOKES.json');

var previousMessageHash = {};
var address = '';
var senderContext = {};
var isStopped = false;

var today = new Date();
var tomorrow = new Date();
var third = new Date();
var fourth = new Date();
var fifth = new Date();
var sixth = new Date();
var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

if (today.getDay() == 6) {
  tomorrow.setDate(today.getDate() + 2);
  third.setDate(tomorrow.getDate() + 1);
  fourth.setDate(third.getDate() + 1);
  fifth.setDate(fourth.getDate() + 1);
  sixth.setDate(fifth.getDate() + 1);
} else if (today.getDay() == 0) {
  tomorrow.setDate(today.getDate() + 1);
  third.setDate(tomorrow.getDate() + 1);
  fourth.setDate(third.getDate() + 1);
  fifth.setDate(fourth.getDate() + 1);
  sixth.setDate(fifth.getDate() + 1);
} else if (today.getDay() == 1) {
  tomorrow.setDate(today.getDate() + 1);
  third.setDate(tomorrow.getDate() + 1);
  fourth.setDate(third.getDate() + 1);
  fifth.setDate(fourth.getDate() + 1);
  sixth.setDate(fifth.getDate() + 3);
} else if (today.getDay() == 2) {
  tomorrow.setDate(today.getDate() + 1);
  third.setDate(tomorrow.getDate() + 1);
  fourth.setDate(third.getDate() + 1);
  fifth.setDate(fourth.getDate() + 3);
  sixth.setDate(fifth.getDate() + 1);
} else if (today.getDay() == 3) {
  tomorrow.setDate(today.getDate() + 1);
  third.setDate(tomorrow.getDate() + 1);
  fourth.setDate(third.getDate() + 3);
  fifth.setDate(fourth.getDate() + 1);
  sixth.setDate(fifth.getDate() + 1);
} else if (today.getDay() == 4) {
  tomorrow.setDate(today.getDate() + 1);
  third.setDate(tomorrow.getDate() + 3);
  fourth.setDate(third.getDate() + 1);
  fifth.setDate(fourth.getDate() + 1);
  sixth.setDate(fifth.getDate() + 1);
} else if (today.getDay() == 5) {
  tomorrow.setDate(today.getDate() + 3);
  third.setDate(tomorrow.getDate() + 1);
  fourth.setDate(third.getDate() + 1);
  fifth.setDate(fourth.getDate() + 1);
  sixth.setDate(fifth.getDate() + 1);
}

//lets require/import the mongodb native drivers.
var mongodb = require('mongodb');

//We need to work with "MongoClient" interface in order to connect to a mongodb server.
var MongoClient = mongodb.MongoClient;

// Connection URL. This is where your mongodb server is running.

//(Focus on This Variable)
const url = process.env.MONGODB_URI;
//(Focus on This Variable)

// Use connect method to connect to the Server
/* 
MongoClient.connect(url, function (err, db) {
  if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
  } else {
    console.log('Connection established to', url);

    // do some work here with the database.
    
    //Close connection
    db.close();
  }
});
 */

var app = express();

app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json({
  verify: verifyRequestSignature
}));
app.use(express.static('public'));

/*
 * Be sure to setup your config values before running this code. You can 
 * set them using environment variables 
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = process.env.APP_SECRET;

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = process.env.VALIDATION_TOKEN;

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Google maps API
const GOOGLEMAPS_API = process.env.GOOGLEMAPS_API;

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function (req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});


/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page. 
 * https://developers.facebook.com/docs/messenger-platform/product-overview/setup#subscribe_app
 *
 */
app.post('/webhook', function (req, res) {

  var data = req.body;
  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function (pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function (messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else if (messagingEvent.read) {
          receivedMessageRead(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

app.get('/db', function (req, res, next) {

  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      console.log('Connection established to', url);

      // do some work here with the database.
      var dbo = db.db("heroku_z4xpjv2q");

      dbo.createCollection("users_table", function (err, res) {
        if (err) {
          console.log('Unable to create table: ', err);
        } else {
          console.log('Successfully built table on', url);
          //Close connection
          db.close();
        }
      });
    }
  });
})

app.get('/setup', function (req, res) {
  setupGetStartedButton();
});


/*
 * Verify that the callback came from Facebook. Using the App Secret from 
 * the App Dashboard, we can verify the signature that is sent with each 
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an 
    // error.
    console.error("Couldn't validate the signature with app secret:" + APP_SECRET);
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
      .update(buf)
      .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature: " + APP_SECRET);
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to 
 * Messenger" plugin, it is the 'data-ref' field. Read more at 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/authentication
 *
 */
function receivedAuthentication(event) {
  if (isStopped == true) {
    return;
  }
  var data = req.body;
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the 
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' 
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

var firstName = "undefined";
var lastName = "undefined";

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message' 
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-received
 *
 * For this example, we're going to echo any text that we get. If we get some 
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've 
 * created. If we receive a message with an attachment (image, video, audio), 
 * then we'll simply confirm that we've received the attachment.
 * 
 */
function receivedMessage(event) {
  callGetLocaleAPI(event, handleReceivedMessage);
}

function handleReceivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;


  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s",
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    //    console.log("Quick reply for message %s with payload %s",
    //     messageId, quickReplyPayload);

    messageText = quickReplyPayload;
    sendCustomMessage(senderID, messageText);
    return;
  }

  if (messageText) {
    if ((isStopped == true) && (messageText !== "start")) {
      return;
    }
    console.log("Received message for user %d and page %d at %d with message: %s",
      senderID, recipientID, timeOfMessage, messageText);

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText.toLowerCase()) {
      case 'image':
        sendImageMessage(senderID, "http://messengerdemo.parseapp.com/img/rift.png");
        break;

      case 'gif':
        sendGifMessage(senderID);
        break;

      case 'audio':
        sendAudioMessage(senderID);
        break;

      case 'video':
        sendVideoMessage(senderID);
        break;

      case 'file':
        sendFileMessage(senderID);
        break;

      case 'button':
        sendButtonMessage(senderID);
        break;
      
      case 'home':
          sendJsonMessage(senderID, "HOME");
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;

      case 'receipt':
        sendReceiptMessage(senderID);
        break;

      case 'quick reply':
        sendQuickReply(senderID);
        break

      case 'read receipt':
        sendReadReceipt(senderID);
        break

      case 'typing on':
        sendTypingOn(senderID);
        break

      case 'typing off':
        sendTypingOff(senderID);
        break

      case 'user info':
        if (firstName)
          sendTextMessage(senderID, firstName);
        break

        /* case 'add menu':
          addPersistentMenu();
          break

        case 'remove menu':
          removePersistentMenu();
          break */

      case 'stop': // Stop the Bot from responding if the admin sends this messages
        if (senderID == 2464058527010934) {
          console.log("Stoppping bot");
          isStopped = true;
        }
        break

      case 'start': // start up again
        if (senderID == 2464058527010934) {
          console.log("Starting bot");
          isStopped = false;
        }
        break

      default:
        sendEnteredMessage(senderID, messageText);

    }
  } else if (messageAttachments) {
    if (messageAttachments[0].payload.url)
      sendJsonMessage(senderID, messageAttachments[0].payload.url);
  }
}


/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about 
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-delivered
 *
 */

function receivedDeliveryConfirmation(event) {
  if (isStopped == true) {
    return;
  }
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function (messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}


/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. 
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/postback-received
 * 
 */

function receivedPostback(event) {
  if (isStopped == true) {
    return;
  }
  callGetLocaleAPI(event, handleReceivedPostback);
}

function handleReceivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  sendCustomMessage(senderID, payload);
}

/*
 * Message Read Event
 *
 * This event is called when a previously-sent message has been read.
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read
 * 
 */
function receivedMessageRead(event) {
  if (isStopped == true) {
    return;
  }
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

/*
 * Send an image using the Send API.
 *
 */
function sendImageMessage(recipientId, path) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: path
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Gif using the Send API.
 *
 */
function sendGifMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: "http://messengerdemo.parseapp.com/img/instagram_logo.gif"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send audio using the Send API.
 *
 */
function sendAudioMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: "http://messengerdemo.parseapp.com/audio/sample.mp3"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 *
 */
function sendVideoMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "video",
        payload: {
          url: "http://messengerdemo.parseapp.com/video/allofus480.mov"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a video using the Send API.
 *
 */
function sendFileMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "file",
        payload: {
          url: "http://messengerdemo.parseapp.com/files/test.txt"
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendSingleJsonMessage(recipientId, filename) {
  try {
    filename = "./script/" + filename;
    var json = require(filename);
    var fullMessage = {
      recipient: {
        id: recipientId
      }
    };
    fullMessage.message = json;
    callSendAPI(fullMessage);
  } catch (e) {
    console.log("error in sendSingleJsonMessage " + e.message + " " + filename + " " + fullMessage);
  }
}

/* 
   Special handling for message that the sender typed in 
*/

function sendEnteredMessage(recipientId, messageText) {
  var emojiString = ["😀", "😁", "😂", "😃", "😄", "😅", "😆", "😇", "😈", "👿", "😉", "😊", "☺️", "😋", "😌", "😍", "😎", "😏", "😐", "😑", "😒", "😓", "😔", "😕", "😖", "😗", "😘", "😙", "😚", "😛", "😜", "😝", "😞", "😟", "😠", "😡", "😢", "😣", "😤", "😥", "😦", "😧", "😨", "😩", "😪", "😫", "😬", "😭", "😮", "😯", "😰", "😱", "😲", "😳", "😴", "😵", "😶", "😷", "😸", "😹", "😺", "😻", "😼", "😽", "😾", "😿", "🙀", "👣", "👤", "👥", "👶", "👶🏻", "👶🏼", "👶🏽", "👶🏾", "👶🏿", "👦", "👦🏻", "👦🏼", "👦🏽", "👦🏾", "👦🏿", "👧", "👧🏻", "👧🏼", "👧🏽", "👧🏾", "👧🏿", "👨", "👨🏻", "👨🏼", "👨🏽", "👨🏾", "👨🏿", "👩", "👩🏻", "👩🏼", "👩🏽", "👩🏾", "👩🏿", "👪", "👨‍👩‍👧", "👨‍👩‍👧‍👦", "👨‍👩‍👦‍👦", "👨‍👩‍👧‍👧", "👩‍👩‍👦", "👩‍👩‍👧", "👩‍👩‍👧‍👦", "👩‍👩‍👦‍👦", "👩‍👩‍👧‍👧", "👨‍👨‍👦", "👨‍👨‍👧", "👨‍👨‍👧‍👦", "👨‍👨‍👦‍👦", "👨‍👨‍👧‍👧", "👫", "👬", "👭", "👯", "👰", "👰🏻", "👰🏼", "👰🏽", "👰🏾", "👰🏿", "👱", "👱🏻", "👱🏼", "👱🏽", "👱🏾", "👱🏿", "👲", "👲🏻", "👲🏼", "👲🏽", "👲🏾", "👲🏿", "👳", "👳🏻", "👳🏼", "👳🏽", "👳🏾", "👳🏿", "👴", "👴🏻", "👴🏼", "👴🏽", "👴🏾", "👴🏿", "👵", "👵🏻", "👵🏼", "👵🏽", "👵🏾", "👵🏿", "👮", "👮🏻", "👮🏼", "👮🏽", "👮🏾", "👮🏿", "👷", "👷🏻", "👷🏼", "👷🏽", "👷🏾", "👷🏿", "👸", "👸🏻", "👸🏼", "👸🏽", "👸🏾", "👸🏿", "💂", "💂🏻", "💂🏼", "💂🏽", "💂🏾", "💂🏿", "👼", "👼🏻", "👼🏼", "👼🏽", "👼🏾", "👼🏿", "🎅", "🎅🏻", "🎅🏼", "🎅🏽", "🎅🏾", "🎅🏿", "👻", "👹", "👺", "💩", "💀", "👽", "👾", "🙇", "🙇🏻", "🙇🏼", "🙇🏽", "🙇🏾", "🙇🏿", "💁", "💁🏻", "💁🏼", "💁🏽", "💁🏾", "💁🏿", "🙅", "🙅🏻", "🙅🏼", "🙅🏽", "🙅🏾", "🙅🏿", "🙆", "🙆🏻", "🙆🏼", "🙆🏽", "🙆🏾", "🙆🏿", "🙋", "🙋🏻", "🙋🏼", "🙋🏽", "🙋🏾", "🙋🏿", "🙎", "🙎🏻", "🙎🏼", "🙎🏽", "🙎🏾", "🙎🏿", "🙍", "🙍🏻", "🙍🏼", "🙍🏽", "🙍🏾", "🙍🏿", "💆", "💆🏻", "💆🏼", "💆🏽", "💆🏾", "💆🏿", "💇", "💇🏻", "💇🏼", "💇🏽", "💇🏾", "💇🏿", "💑", "👩‍❤️‍👩", "👨‍❤️‍👨", "💏", "👩‍❤️‍💋‍👩", "👨‍❤️‍💋‍👨", "🙌", "🙌🏻", "🙌🏼", "🙌🏽", "🙌🏾", "🙌🏿", "👏", "👏🏻", "👏🏼", "👏🏽", "👏🏾", "👏🏿", "👂", "👂🏻", "👂🏼", "👂🏽", "👂🏾", "👂🏿", "👀", "👃", "👃🏻", "👃🏼", "👃🏽", "👃🏾", "👃🏿", "👄", "💋", "👅", "💅", "💅🏻", "💅🏼", "💅🏽", "💅🏾", "💅🏿", "👋", "👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿", "👍", "👍🏻", "👍🏼", "👍🏽", "👍🏾", "👍🏿", "👎", "👎🏻", "👎🏼", "👎🏽", "👎🏾", "👎🏿", "☝", "☝🏻", "☝🏼", "☝🏽", "☝🏾", "☝🏿", "👆", "👆🏻", "👆🏼", "👆🏽", "👆🏾", "👆🏿", "👇", "👇🏻", "👇🏼", "👇🏽", "👇🏾", "👇🏿", "👈", "👈🏻", "👈🏼", "👈🏽", "👈🏾", "👈🏿", "👉", "👉🏻", "👉🏼", "👉🏽", "👉🏾", "👉🏿", "👌", "👌🏻", "👌🏼", "👌🏽", "👌🏾", "👌🏿", "✌", "✌🏻", "✌🏼", "✌🏽", "✌🏾", "✌🏿", "👊", "👊🏻", "👊🏼", "👊🏽", "👊🏾", "👊🏿", "✊", "✊🏻", "✊🏼", "✊🏽", "✊🏾", "✊🏿", "✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿", "💪", "💪🏻", "💪🏼", "💪🏽", "💪🏾", "💪🏿", "👐", "👐🏻", "👐🏼", "👐🏽", "👐🏾", "👐🏿", "🙏", "🙏🏻", "🙏🏼", "🙏🏽", "🙏🏾", "🙏🏿", "🌱", "🌲", "🌳", "🌴", "🌵", "🌷", "🌸", "🌹", "🌺", "🌻", "🌼", "💐", "🌾", "🌿", "🍀", "🍁", "🍂", "🍃", "🍄", "🌰", "🐀", "🐁", "🐭", "🐹", "🐂", "🐃", "🐄", "🐮", "🐅", "🐆", "🐯", "🐇", "🐰", "🐈", "🐱", "🐎", "🐴", "🐏", "🐑", "🐐", "🐓", "🐔", "🐤", "🐣", "🐥", "🐦", "🐧", "🐘", "🐪", "🐫", "🐗", "🐖", "🐷", "🐽", "🐕", "🐩", "🐶", "🐺", "🐻", "🐨", "🐼", "🐵", "🙈", "🙉", "🙊", "🐒", "🐉", "🐲", "🐊", "🐍", "🐢", "🐸", "🐋", "🐳", "🐬", "🐙", "🐟", "🐠", "🐡", "🐚", "🐌", "🐛", "🐜", "🐝", "🐞", "🐾", "⚡️", "🔥", "🌙", "☀️", "⛅️", "☁️", "💧", "💦", "☔️", "💨", "❄️", "🌟", "⭐️", "🌠", "🌄", "🌅", "🌈", "🌊", "🌋", "🌌", "🗻", "🗾", "🌐", "🌍", "🌎", "🌏", "🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌚", "🌝", "🌛", "🌜", "🌞", "🍅", "🍆", "🌽", "🍠", "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🍔", "🍕", "🍖", "🍗", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍞", "🍟", "🍡", "🍢", "🍣", "🍤", "🍥", "🍦", "🍧", "🍨", "🍩", "🍪", "🍫", "🍬", "🍭", "🍮", "🍯", "🍰", "🍱", "🍲", "🍳", "🍴", "🍵", "☕️", "🍶", "🍷", "🍸", "🍹", "🍺", "🍻", "🍼", "🎀", "🎁", "🎂", "🎃", "🎄", "🎋", "🎍", "🎑", "🎆", "🎇", "🎉", "🎊", "🎈", "💫", "✨", "💥", "🎓", "👑", "🎎", "🎏", "🎐", "🎌", "🏮", "💍", "❤️", "💔", "💌", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💜", "💛", "💚", "💙", "🏃", "🏃🏻", "🏃🏼", "🏃🏽", "🏃🏾", "🏃🏿", "🚶", "🚶🏻", "🚶🏼", "🚶🏽", "🚶🏾", "🚶🏿", "💃", "💃🏻", "💃🏼", "💃🏽", "💃🏾", "💃🏿", "🚣", "🚣🏻", "🚣🏼", "🚣🏽", "🚣🏾", "🚣🏿", "🏊", "🏊🏻", "🏊🏼", "🏊🏽", "🏊🏾", "🏊🏿", "🏄", "🏄🏻", "🏄🏼", "🏄🏽", "🏄🏾", "🏄🏿", "🛀", "🛀🏻", "🛀🏼", "🛀🏽", "🛀🏾", "🛀🏿", "🏂", "🎿", "⛄️", "🚴", "🚴🏻", "🚴🏼", "🚴🏽", "🚴🏾", "🚴🏿", "🚵", "🚵🏻", "🚵🏼", "🚵🏽", "🚵🏾", "🚵🏿", "🏇", "🏇🏻", "🏇🏼", "🏇🏽", "🏇🏾", "🏇🏿", "⛺️", "🎣", "⚽️", "🏀", "🏈", "⚾️", "🎾", "🏉", "⛳️", "🏆", "🎽", "🏁", "🎹", "🎸", "🎻", "🎷", "🎺", "🎵", "🎶", "🎼", "🎧", "🎤", "🎭", "🎫", "🎩", "🎪", "🎬", "🎨", "🎯", "🎱", "🎳", "🎰", "🎲", "🎮", "🎴", "🃏", "🀄️", "🎠", "🎡", "🎢", "🚃", "🚞", "🚂", "🚋", "🚝", "🚄", "🚅", "🚆", "🚇", "🚈", "🚉", "🚊", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚨", "🚕", "🚖", "🚗", "🚘", "🚙", "🚚", "🚛", "🚜", "🚲", "🚏", "⛽️", "🚧", "🚦", "🚥", "🚀", "🚁", "✈️", "💺", "⚓️", "🚢", "🚤", "⛵️", "🚡", "🚠", "🚟", "🛂", "🛃", "🛄", "🛅", "💴", "💶", "💷", "💵", "🗽", "🗿", "🌁", "🗼", "⛲️", "🏰", "🏯", "🌇", "🌆", "🌃", "🌉", "🏠", "🏡", "🏢", "🏬", "🏭", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "💒", "⛪️", "🏪", "🏫", "🇦🇺", "🇦🇹", "🇧🇪", "🇧🇷", "🇨🇦", "🇨🇱", "🇨🇳", "🇨🇴", "🇩🇰", "🇫🇮", "🇫🇷", "🇩🇪", "🇭🇰", "🇮🇳", "🇮🇩", "🇮🇪", "🇮🇱", "🇮🇹", "🇯🇵", "🇰🇷", "🇲🇴", "🇲🇾", "🇲🇽", "🇳🇱", "🇳🇿", "🇳🇴", "🇵🇭", "🇵🇱", "🇵🇹", "🇵🇷", "🇷🇺", "🇸🇦", "🇸🇬", "🇿🇦", "🇪🇸", "🇸🇪", "🇨🇭", "🇹🇷", "🇬🇧", "🇺🇸", "🇦🇪", "🇻🇳", "⌚️", "📱", "📲", "💻", "⏰", "⏳", "⌛️", "📷", "📹", "🎥", "📺", "📻", "📟", "📞", "☎️", "📠", "💽", "💾", "💿", "📀", "📼", "🔋", "🔌", "💡", "🔦", "📡", "💳", "💸", "💰", "💎", "🌂", "👝", "👛", "👜", "💼", "🎒", "💄", "👓", "👒", "👡", "👠", "👢", "👞", "👟", "👙", "👗", "👘", "👚", "👕", "👔", "👖", "🚪", "🚿", "🛁", "🚽", "💈", "💉", "💊", "🔬", "🔭", "🔮", "🔧", "🔪", "🔩", "🔨", "💣", "🚬", "🔫", "🔖", "📰", "🔑", "✉️", "📩", "📨", "📧", "📥", "📤", "📦", "📯", "📮", "📪", "📫", "📬", "📭", "📄", "📃", "📑", "📈", "📉", "📊", "📅", "📆", "🔅", "🔆", "📜", "📋", "📖", "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📇", "🔗", "📎", "📌", "✂️", "📐", "📍", "📏", "🚩", "📁", "📂", "✒️", "✏️", "📝", "🔏", "🔐", "🔒", "🔓", "📣", "📢", "🔈", "🔉", "🔊", "🔇", "💤", "🔔", "🔕", "💭", "💬", "🚸", "🔍", "🔎", "🚫", "⛔️", "📛", "🚷", "🚯", "🚳", "🚱", "📵", "🔞", "🉑", "🉐", "💮", "㊙️", "㊗️", "🈴", "🈵", "🈲", "🈶", "🈚️", "🈸", "🈺", "🈷", "🈹", "🈳", "🈂", "🈁", "🈯️", "💹", "❇️", "✳️", "❎", "✅", "✴️", "📳", "📴", "🆚", "🅰", "🅱", "🆎", "🆑", "🅾", "🆘", "🆔", "🅿️", "🚾", "🆒", "🆓", "🆕", "🆖", "🆗", "🆙", "🏧", "♈️", "♉️", "♊️", "♋️", "♌️", "♍️", "♎️", "♏️", "♐️", "♑️", "♒️", "♓️", "🚻", "🚹", "🚺", "🚼", "♿️", "🚰", "🚭", "🚮", "▶️", "◀️", "🔼", "🔽", "⏩", "⏪", "⏫", "⏬", "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "🔄", "↪️", "↩️", "⤴️", "⤵️", "🔀", "🔁", "🔂", "#⃣", "0⃣", "1⃣", "2⃣", "3⃣", "4⃣", "5⃣", "6⃣", "7⃣", "8⃣", "9⃣", "🔟", "🔢", "🔤", "🔡", "🔠", "ℹ️", "📶", "🎦", "🔣", "➕", "➖", "〰", "➗", "✖️", "✔️", "🔃", "™", "©", "®", "💱", "💲", "➰", "➿", "〽️", "❗️", "❓", "❕", "❔", "‼️", "⁉️", "❌", "⭕️", "💯", "🔚", "🔙", "🔛", "🔝", "🔜", "🌀", "Ⓜ️", "⛎", "🔯", "🔰", "🔱", "⚠️", "♨️", "♻️", "💢", "💠", "♠️", "♣️", "♥️", "♦️", "☑️", "⚪️", "⚫️", "🔘", "🔴", "🔵", "🔺", "🔻", "🔸", "🔹", "🔶", "🔷", "▪️", "▫️", "⬛️", "⬜️", "◼️", "◻️", "◾️", "◽️", "🔲", "🔳", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛", "🕜", "🕝", "🕞", "🕟", "🕠", "🕡", "🕢", "🕣", "🕤", "🕥", "🕦", "🕧"]

  console.log("sendEnteredMessage " + messageText);

  if (previousMessageHash[recipientId] === 'send a message') {
    sendTextMessage(2464058527010934, messageText); // send a message to Matthew directly
  } else if (previousMessageHash[recipientId] === 'show on map') {
    sendLocation(recipientId, messageText);
  } else if (previousMessageHash[recipientId] === 'mylocation') {
    sendLocation(recipientId, messageText);
  } else if (previousMessageHash[recipientId] === 'getdirection') {
    sendDirection(recipientId, messageText);
  } else if (senderContext[recipientId].state === 'addKeywordButton') {
    addKeywordButtonStep2(recipientId, messageText);
  } else if (emojiString.indexOf(messageText.substring(0, 2)) > -1) {
    var maxLength = emojiString.length;
    var random = Math.floor(Math.random() * maxLength);
    messageText = emojiString[random];
    sendTextMessage(recipientId, messageText);
  } else {
    sendCustomMessage(recipientId, messageText);
  }
}

function sendCustomMessage(recipientId, messageText) {

  console.log("sendCustoMessage " + messageText);

  switch (messageText.toLowerCase()) {

    case 'joke':
      sendJoke(recipientId);
      break

    case 'image':
      sendRandomImage(recipientId);
      break

    case 'who':
      sendLocale(recipientId);
      break

    case 'select date and time':
      sendDateSelection(recipientId);
      break

    case '10am':
      var actualDate = "\n" + tomorrow.getDate() + "/" + tomorrow.getMonth() + "/" + tomorrow.getFullYear() + " : " + days[tomorrow.getDay()]
      sendDateReply(messageText, recipientId, firstName, actualDate);
      sendAppointMessage(2464058527010934, messageText, recipientId, firstName, lastName, actualDate);
      break

    case 'selfservice':
      sendGenericMessage(recipientId);
      break
    
    case 'contactperson':
      sendContactButton(recipientId);
      break

    case 'get_started_payload':
      sendJsonMessage(recipientId, "HOME");
      addUsertoDatabase(recipientId);
      break

    case 'addkeyword_button3':
      addKeywordButtonStep3(recipientId, 3);
      break


    default:
      sendJsonMessage(recipientId, messageText);

  }
  previousMessageHash[recipientId] = messageText.toLowerCase();
}

function sendJsonMessage(recipientId, keyword) {
  console.log("sendJsonMessage " + keyword);
  if (_.has(scriptRules, keyword.toUpperCase())) {
    sendSingleJsonMessage(recipientId, scriptRules[keyword.toUpperCase()]);
  } else if (_.has(customRules, keyword.toUpperCase())) {
    sendSingleJsonMessage(recipientId, customRules[keyword.toUpperCase()]);
  } else {
    sendGenericMessage(recipientId);
  }
}

function addUsertoDatabase(recipientId) {

  var today = new Date();
  var date = today.getDate()+"/"+(today.getMonth()+1)+"/"+today.getFullYear();
  var time = (today.getUTCHours()+8) + ":" + today.getMinutes() + ":" + today.getSeconds() + " (GMT+8)";

  var Data = {
    user_ID: recipientId,
    First_name: firstName,
    Last_name: lastName,
    Date: date,
    Time: time
  }

  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      console.log('Connection established to', url);

      // do some work here with the database.
      var dbo = db.db("heroku_z4xpjv2q");

      dbo.collection("users_table").insertOne(Data, function (err, res) {
        if (err) {
          console.log('Unable to insert user: ', err);
        } else {
          console.log('Successfully inserted user', url);
          //Close connection
          db.close();
        }
      });
    }
  });
}



/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    "recipient": {
      "id": recipientId
    },
    "message": {
      "text": messageText,
      "metadata": "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

function sendAppointMessage(ownId, messageText, recipientId, firstName, lastName, actualDate) {
  var messageData = {
    "recipient": {
      "id": ownId
    },
    "message": {
      "text": firstName + " " + lastName + " (" + recipientId + ")" + " has made an appointment at " + messageText + " on " + actualDate,
      "metadata": "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Joke with Quick Reply buttons.
 *
 */
function sendJoke(recipientId) {

  var jokeString = "";

  while (jokeString === "") {
    var random = Math.floor(Math.random() * jokes.length);
    if (jokes[random].joke.length < 320) // better be a least one good joke :) 
      jokeString = jokes[random].joke;
  }

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: jokeString,
      quick_replies: [{
          "content_type": "text",
          "title": "Another 😂",
          "payload": "joke"
        },
        {
          "content_type": "text",
          "title": "Home",
          "payload": "home"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

/*
 * Send the user information back, the bot grabs this for every message
 *
 */
function sendLocale(recipientId) {

  var nameString = firstName + " " + lastName;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: nameString,
      quick_replies: [{
        "content_type": "text",
        "title": "Home",
        "payload": "home"
      }]
    }
  };

  callSendAPI(messageData);
}

/*
 * Simple example of an external http call with parsing.
 *
 */
function sendRandomImage(recipientId) {
  sendImageMessage(recipientId, "https://unsplash.it/400/600/?random");
}

/*
 * Send a button message using the Send API.
 *
 */
function sendContactButton(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "You can either message me through Whatsapp or call me!",
          buttons: [{
            type: "web_url",
            url: "https://wa.me/60174567274?text=Hi!%20May%20I%20ask%20you%20something?",
            title: "Whatsapp Text"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+60174567274"
          }, {
            type: "postback",
            title: "Go Back",
            payload: "HOME"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
              "title": "News & Tips",
              "subtitle": "Get the latest news and tips from prefessionals.",
              "image_url": "https://raw.githubusercontent.com/matthewericfisher/fb-robot/master/img/robot.png",
              "buttons": [{
                  "type": "web_url",
                  "title": "Articles",
                  "url": "www.facebook.com"
                },
                {
                  "type": "web_url",
                  "title": "Tips",
                  "url": "www.facebook.com"
                },
                {
                  "type": "web_url",
                  "title": "Website",
                  "url": "www.facebook.com"
                }
              ]
            },
            {
              "title": "Financial Assessment",
              "subtitle": "Let my bot guide you through a which plan suits you.",
              "image_url": "https://raw.githubusercontent.com/matthewericfisher/fb-robot/master/img/evolution.png",
              "buttons": [{
                  "type": "postback",
                  "title": "Calculator",
                  "payload": "Contact"
                },
                {
                  "type": "postback",
                  "title": "Website",
                  "payload": "Social media"
                },
                {
                  "type": "postback",
                  "title": "Contact",
                  "payload": "bio"
                }
              ]
            },
            {
              "title": "Jio me Yamcha mou?",
              "subtitle": "I can hear you out while having a drink!",
              "image_url": "https://raw.githubusercontent.com/matthewericfisher/fb-robot/master/img/danger-man-at-work-hi.png",
              "buttons": [{
                  "type": "postback",
                  "title": "Tell me a joke 😜",
                  "payload": "joke"
                },
                {
                  "type": "web_url",
                  "title": "FREE Policy Review",
                  "url": "https://fb.com/book/106645720711781/",
                  "webview_height_ratio": "tall"
                },
                {
                  "type": "web_url",
                  "title": "FREE consultation",
                  "url": "https://fb.com/book/106645720711781/",
                  "webview_height_ratio": "tall"
                }
              ]
            },
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendDateSelection(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
              "title": tomorrow.getDate() + "/" + tomorrow.getMonth() + "/" + tomorrow.getFullYear() + "\n" + days[tomorrow.getDay()],
              "subtitle": "Select timeslot",
              "buttons": [{
                  "type": "postback",
                  "title": "10:00",
                  "payload": "10am"
                },
                {
                  "type": "postback",
                  "title": "13:00",
                  "payload": "appreplytwo"
                },
                {
                  "type": "postback",
                  "title": "16:00",
                  "payload": "appreplythree"
                }
              ]
            },
            {
              "title": third.getDate() + "/" + third.getMonth() + "/" + third.getFullYear() + "\n" + days[third.getDay()],
              "subtitle": "Select your desired timeslot",
              "buttons": [{
                  "type": "postback",
                  "title": "10:00",
                  "payload": "appreply"
                },
                {
                  "type": "postback",
                  "title": "13:00",
                  "payload": "appreply"
                },
                {
                  "type": "postback",
                  "title": "16:00",
                  "payload": "appreply"
                }
              ]
            },
            {
              "title": fourth.getDate() + "/" + fourth.getMonth() + "/" + fourth.getFullYear() + "\n" + days[fourth.getDay()],
              "subtitle": "Select your desired timeslot",
              "buttons": [{
                  "type": "postback",
                  "title": "10:00",
                  "payload": "appreply"
                },
                {
                  "type": "postback",
                  "title": "13:00",
                  "payload": "appreply"
                },
                {
                  "type": "postback",
                  "title": "16:00",
                  "payload": "appreply"
                }
              ]
            },
            {
              "title": fifth.getDate() + "/" + fifth.getMonth() + "/" + fifth.getFullYear() + "\n" + days[fifth.getDay()],
              "subtitle": "Select your desired timeslot",
              "buttons": [{
                  "type": "postback",
                  "title": "10:00",
                  "payload": "appreply"
                },
                {
                  "type": "postback",
                  "title": "13:00",
                  "payload": "appreply"
                },
                {
                  "type": "postback",
                  "title": "16:00",
                  "payload": "appreply"
                }
              ]
            },
            {
              "title": sixth.getDate() + "/" + sixth.getMonth() + "/" + sixth.getFullYear() + "\n" + days[sixth.getDay()],
              "subtitle": "Select your desired timeslot",
              "buttons": [{
                  "type": "postback",
                  "title": "10:00",
                  "payload": "appointment"
                },
                {
                  "type": "postback",
                  "title": "13:00",
                  "payload": "business"
                },
                {
                  "type": "postback",
                  "title": "16:00",
                  "payload": "I want one"
                }
              ]
            }
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendLocation(recipientId, messageText) {

  // for distance (returns JSON containing values for distance[m] and time[s])
  // https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=Washington,DC&destinations=New+York+City,NY&key= API_KEY
  // for directions
  // https://maps.googleapis.com/maps/api/directions/json?origin=Disneyland&destination=Universal+Studios+Hollywood&key= API_KEY

  address = messageText.replace(/ /g, "-");

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": messageText,
            "image_url": "https://maps.googleapis.com/maps/api/staticmap?size=764x400&markers=color:red%7Clabel:Y%7C" + address + "&maptype=roadmap&key=" + GOOGLEMAPS_API,
            "buttons": [{
                "type": "web_url",
                "url": "http://maps.apple.com/maps?q=" + address,
                "title": "View on Maps",
                "webview_height_ratio": "tall"
              },
              {
                "type": "postback",
                "title": "Another one",
                "payload": "show on map"
              },
              {
                "type": "postback",
                "title": "Directions",
                "payload": "getdirection"
              }
            ]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendDirection(recipientId, messageText) {

  var current = messageText.replace(/ /g, "-");

  var uri = "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=" + current + "&destinations=" + address + "&key=" + GOOGLEMAPS_API;
  console.log(uri)

  request(uri, { json: true }, (err, res, body) => {
    if (err) { return console.log(err); }
    var distance = (body.rows[0].elements[0].distance.value)/1000;
    var time = body.rows[0].elements[0].duration.text

    var messageData = {
      recipient: {
        id: recipientId
      },
      message: {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": "From: " + body.origin_addresses + "\nTo: " + body.destination_addresses + "\nTravel distance: " + distance + " km" + "\nTravel time: " + time,
            "buttons": [{
              "type": "web_url",
              "url": "https://www.google.com.my/maps/dir/" + address + "/" + current,
              "title": "View on Map",
              "webview_height_ratio": "tall"
            }]
          }
        }
      }
    };
  
    callSendAPI(messageData);
  });

}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random() * 1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",
          timestamp: "1428444852",
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Some regular buttons and a location test",
      quick_replies: [{
          "content_type": "text",
          "title": "Action",
          "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
        },
        {
          "content_type": "text",
          "title": "Something else",
          "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_SOMETHING"
        },
        {
          "content_type": "location",
          "title": "Send Location",
          "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_LOCATION"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

function sendDateReply(messageText, recipientId, firstName, actualDate) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Thank you, " + firstName + ". You have succesfully made an appointment at " + messageText + " on " + actualDate,
      metadata: "DEVELOPER_DEFINED_METADATA",
    }
  };

  MongoClient.connect(url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      console.log('Connection established to', url);

      // do some work here with the database.
      var dbo = db.db("heroku_z4xpjv2q");

      dbo.collection("users_table").insertOne(messageData, function (err, res) {
        if (err) {
          console.log('Unable to insert user: ', err);
        } else {
          console.log('Successfully inserted user', url);
          //Close connection
          db.close();
        }
      });
    }
  });

  callSendAPI(messageData);
}

/*
 * Send a read receipt to indicate the message has been read
 *
 */
function sendReadReceipt(recipientId) {
  console.log("Sending a read receipt to mark message as seen");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "mark_seen"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator on
 *
 */
function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

/*
 * Turn typing indicator off
 *
 */
function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}


/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s",
          messageId, recipientId);
      } else {
        console.log("Successfully called Send API for recipient %s",
          recipientId);
      }
    } else {
      console.error("Unable to send message. :" + response.error);
    }
  });
}

/*
 * Call the Get Locale API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callGetLocaleAPI(event, handleReceived) {
  var userID = event.sender.id;
  var http = require('https');
  var path = '/v2.6/' + userID + '?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=' + PAGE_ACCESS_TOKEN;
  var options = {
    host: 'graph.facebook.com',
    path: path
  };

  if (senderContext[userID]) {
    firstName = senderContext[userID].firstName;
    lastName = senderContext[userID].lastName;
    console.log("found " + JSON.stringify(senderContext[userID]));
    if (!firstName)
      firstName = "undefined";
    if (!lastName)
      lastName = "undefined";
    handleReceived(event);
    return;
  }

  var req = http.get(options, function (res) {
    //console.log('STATUS: ' + res.statusCode);
    //console.log('HEADERS: ' + JSON.stringify(res.headers));

    // Buffer the body entirely for processing as a whole.
    var bodyChunks = [];
    res.on('data', function (chunk) {
      // You can process streamed parts here...
      bodyChunks.push(chunk);
    }).on('end', function () {
      var body = Buffer.concat(bodyChunks);
      var bodyObject = JSON.parse(body);
      firstName = bodyObject.first_name;
      lastName = bodyObject.last_name;
      if (!firstName)
        firstName = "undefined";
      if (!lastName)
        lastName = "undefined";
      senderContext[userID] = {};
      senderContext[userID].firstName = firstName;
      senderContext[userID].lastName = lastName;
      console.log("defined " + JSON.stringify(senderContext));
      handleReceived(event);
    })
  });
  req.on('error', function (e) {
    console.log('ERROR: ' + e.message);
  });
}

function setupGetStartedButton() {

  request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: {
      "get_started": {
        "payload": "HOME"
      }
    }
  }, function (error, response, body) {
    console.log("Add get started button " + response)
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
}

/* function AddPersistentMenu() {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: {
      "persistent_menu": [{
          "locale": "default",
          "composer_input_disabled": false,
          "call_to_actions": [{
              "title": "Home",
              "type": "postback",
              "payload": "HOME"
            },
            {
              "title": "Nested Menu Example",
              "type": "nested",
              "call_to_actions": [{
                  "title": "Who am I",
                  "type": "postback",
                  "payload": "WHO"
                },
                {
                  "title": "Joke",
                  "type": "postback",
                  "payload": "joke"
                },
                {
                  "title": "Technical",
                  "type": "postback",
                  "payload": "technical"
                }
              ]
            },
            {
              "type": "web_url",
              "title": "Latest News",
              "url": "http://foxnews.com",
              "webview_height_ratio": "full"
            }
          ]
        },
        {
          "locale": "zh_CN",
          "composer_input_disabled": false
        }
      ]
    }

  }, function (error, response, body) {
    console.log(response)
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
} */

/* function removePersistentMenu() {
  request({
    url: 'https://graph.facebook.com/v2.6/me/thread_settings',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: {
      setting_type: "call_to_actions",
      thread_state: "existing_thread",
      call_to_actions: []
    }

  }, function (error, response, body) {
    console.log(response)
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
} */

function addKeywordStep1(recipientId) {
  sendTextMessage(recipientId, "The keyword will drive the actions by the Bot.  The user can type in the keyword or it can be triggered by a link.  The keyword can contain letters, numbers and spaces. Please type in the keyword:");
  senderContext[recipientId].state = "addKeywordStep1";
}

function addKeywordStep2(recipientId, messageText) {
  senderContext[recipientId].keyword = messageText;
  senderContext[recipientId].state = "addKeywordStep2";
  sendJsonMessage(recipientId, "addKeywordStep2");
}

function stateMachineError(recipientId) {
  sendTextMessage(recipientId, "Sorry the Bot is confused.  We will have to start again.");
  senderContext[recipientId].state = "";
  senderContext[recipientId].keyword = "";
}

function addKeywordText(recipientId) {
  console.log("addKeywordText " + JSON.stringify(senderContext));

  if (senderContext[recipientId].state === "addKeywordStep2") {
    sendTextMessage(recipientId, "Please type in the text to be sent to the user when this keyword is used.");
    senderContext[recipientId].state = "addKeywordText";
  } else {
    stateMachineError(recipientId);
  }
}

function addKeywordTextStep2(recipientId, messageText) {
  if (senderContext[recipientId].state === "addKeywordText") {
    var filename = senderContext[recipientId].keyword.toUpperCase() + ".json";
    var contents = '{"text": "' + messageText + '" }';
    console.log("contents: " + contents);
    fs.writeFile("script/" + filename, contents, function (err) {
      if (err) {
        return console.log(err);
      }
      console.log("The file was saved!");
      senderContext[recipientId].state = "";
      customRules[senderContext[recipientId].keyword.toUpperCase()] = senderContext[recipientId].keyword.toUpperCase();
      sendTextMessage(recipientId, "The keyword has been added.  Please type in the keyword to see the response.");

      /*
      fs.readFile(filename, function read(err, data) {
          if (err) {
              throw err;
          }

          // Invoke the next step here however you like
          console.log("file contains: " + data);  
      });
      */
    });
  } else {
    stateMachineError(recipientId);
  }
}

function addKeywordButton(recipientId) {
  console.log("addKeywordButton " + JSON.stringify(senderContext));

  if (senderContext[recipientId].state === "addKeywordStep2") {
    sendTextMessage(recipientId, "Please type in the title for the button.");
    senderContext[recipientId].state = "addKeywordButton";
  } else {
    stateMachineError(recipientId);
  }
}

function addKeywordButtonStep2(recipientId, messageText) {
  if (senderContext[recipientId].state === "addKeywordButton") {
    senderContext[recipientId].state = "addKeywordButtonStep2";
    sendSingleJsonMessage(recipientId, "ADDKEYWORD_BUTTONSTEP2.json");
  } else {
    stateMachineError(recipientId);
  }
}

function addKeywordButtonStep3(recipientId, buttonCount) {
  if (senderContext[recipientId].state === "addKeywordButtonStep2") {
    senderContext[recipientId].state = "addKeywordButtonStep3";
    senderContext[recipientId].buttonCount = buttonCount;
    sendSingleJsonMessage(recipientId, "ADDKEYWORD_BUTTONSTEP3.json");
  } else {
    stateMachineError(recipientId);
  }
}

function sendKeywordList(recipientId) {
  //  if (customRules.length > 0) 
  if (1) {
    var keys = Object.keys(customRules);

    for (var p in keys) {
      if (keys.hasOwnProperty(p)) {
        sendTextMessage(recipientId, keys[p]);
      }
    }
  } else {
    sendTextMessage(recipientId, "No custom keywords defined yet");
  }
  return;
}


// Start server
// Webhooks must be available via SSL with a certificate signed by a valid 
// certificate authority.
app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;