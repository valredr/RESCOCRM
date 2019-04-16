/// <reference path="../JSBridge.js" />
/// <reference path="../Schema.js" />
/// <reference path="../Common.js" />

var FS = FS || {};

FS.BotChatLoader = {
    botDivName: "bot",
    botName: null,
    defaultUserId: "anonymous",
    detect: "detect",
    errorDivName: "error",
    localization: null,
    speechVoiceName: "Microsoft Server Speech Text to Speech Voice (en-US, JessaRUS)",
    waitMsg: null,

    onLoad: function(botName) {
        FS.BotChatLoader.botName = botName;
        MobileCRM.Localization.initialize(FS.BotChatLoader.storeLocalization, MobileCRM.bridge.alert);
    },

    storeLocalization: function(localization) {
        FS.BotChatLoader.localization = localization;
        FS.BotChatLoader.setupBot();
    },

    setupBot: function() {
        if (FS.BotChatLoader.botName) {
            FS.BotChatLoader.authorizeConversation(FS.BotChatLoader.botName);
            return null;
        }
        else {
            var fetch = FS.BotChatLoader.getFetchForBot();
            return FS.Common.executeFetch(fetch, "Array", null)
                .then(FS.BotChatLoader.getBotName, FS.BotChatLoader.showErrorExecuteFetch)
                .then(FS.BotChatLoader.authorizeConversation)
                .catch(FS.BotChatLoader.showError);
        }
    },

    getFetchForBot: function() {
        var entity = new MobileCRM.FetchXml.Entity(FS.Schema.BotConnection.name);
        entity.addAttribute(FS.Schema.BotConnection.properties.name); // index 0
        var fetch = new MobileCRM.FetchXml.Fetch(entity);
        return fetch;
    },

    authorizeConversation: function (botName) {
        FS.BotChatLoader.waitMsg = MobileCRM.UI.Form.showPleaseWait(FS.BotChatLoader.localization.get("Alert.BotAuthorizing"));
        FS.BotChatLoader.botName = botName;
        document.getElementById(FS.BotChatLoader.errorDivName).innerText = "";

        var params = {
            BotConnectionName: FS.BotChatLoader.botName
        };

        MobileCRM.Workflow.Action.execute(FS.Common.Workflows.authorizeConversation,
            params,
            FS.BotChatLoader.renderBotChat,
            FS.BotChatLoader.displayError);
    },

    showErrorExecuteFetch: function(e) {
        throw new Error(FS.BotChatLoader.localization.get("Alert.FetchingBots"));
    },

    getBingToken: function () {
        return new Promise(function (resolve, reject) {
            var params = {
                BotConnectionName: FS.BotChatLoader.botName
            };

            MobileCRM.Workflow.Action.execute(FS.Common.Workflows.getBingSpeechToken, params,
                function (response) {
                    resolve(response.Token);
                },
                function (error) {
                    var msg = FS.BotChatLoader.localization.get("Alert.BingSpeechAuthorizing.Failure");
                    MobileCRM.bridge.alert(msg);
                    reject(new Error(error));
                });
        });
    },

    showError: function(err) {
        MobileCRM.bridge.alert(err.message);
    },

    getBotName: function(result) {
        if (result == null || result.length < 1) {
            throw new Error(FS.BotChatLoader.localization.get("Alert.NoBotsReceived"));
        }

        if (result.length > 1) {
            throw new Error(FS.BotChatLoader.localization.get("Alert.MultipleBots"));
        }

        var botRecord = result[0];
        return botRecord[0];
    },

    renderBotChat: function (conversation) {
        var speechOptions = null;

        speechOptions = {
            speechRecognizer: new CognitiveServices.SpeechRecognizer({
                fetchCallback: FS.BotChatLoader.getBingToken,
                fetchOnExpiryCallback: FS.BotChatLoader.getBingToken
            }),

            speechSynthesizer: new CognitiveServices.SpeechSynthesizer({
                fetchCallback: FS.BotChatLoader.getBingToken,
                fetchOnExpiryCallback: FS.BotChatLoader.getBingToken,
                gender: 1,
                voiceName: FS.BotChatLoader.speechVoiceName
            })
        };

        BotChat.App({
            directLine: {
                token: conversation.Token,
                webSocket: false
            },
            user: {
                id: conversation.BotUserId ? conversation.BotUserId : FS.BotChatLoader.defaultUserId,
                name: conversation.UserName
            },
            bot: {
                id: FS.BotChatLoader.botName
            },
            resize: FS.BotChatLoader.detect,
            speechOptions: speechOptions,
            chatTitle: false
        }, document.getElementById(FS.BotChatLoader.botDivName));

        FS.BotChatLoader.waitMsg.close();
    },

    displayError: function (message) {
        if (FS.BotChatLoader.waitMsg) {
            FS.BotChatLoader.waitMsg.close();
        }
        MobileCRM.bridge.log(message);
        document.getElementById(FS.BotChatLoader.errorDivName).innerText = FS.BotChatLoader.localization.get("Alert.BotAuthorizing.Failure");
    },

    navigateTo: function (url, windowName, windowFeatures) {
        if (url.indexOf("https://www.bing.com/maps") != -1) {
            var startIndex = url.indexOf("~pos.");
            var endIndex = url.indexOf("&lvl=", startIndex + 5);
            if (startIndex != -1 && endIndex != -1) {
                var destination = url.substring(startIndex + 5, endIndex).split("_");
                if (destination.length == 2 && !isNaN(destination[0]) && !isNaN(destination[1])) {
                    return MobileCRM.Platform.navigateTo(destination[0], destination[1], MobileCRM.bridge.alert, null);
                }
                else {
                    return MobileCRM.Platform.openUrl(url);
                }
            }
            else {
                return MobileCRM.Platform.openUrl(url);
            }
        }
        else {
            return MobileCRM.Platform.openUrl(url);
        }
    }
};
