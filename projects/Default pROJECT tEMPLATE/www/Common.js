var FS = FS || {};

FS.Common = {
    messageBox: function (message, items, callback) {
        /// <summary>Show message in the message box.</summary>
        /// <param name='message' type='String'>A message.</param>
        /// <param name='items' type='Array'>Button items.</param>
        /// <param name='callback' type='function(Object)'>Callback that will be executed.</param>

        var popup = new MobileCRM.UI.MessageBox(message);
        popup.items = items;
        popup.multiLine = true; // Ensures that the message fits
        popup.show(callback);
    },

    Events: {
        workOrderPrimaryIncidentTypeChanged: "workOrderPrimaryIncidentTypeChanged"
    },

    CustomCommands: {
        customFollowUp: "custom_FollowUp",
        customMarkComplete: "custom_MarkComplete",
        customMarkCompleteList: "custom_MarkCompleteList"
    }, 

    executeFetch: function (fetch, output, scope) {
        /// <summary>Promise based wrapper for MobileCRM.FetchXml.Fetch.execute method.</summary>
        /// <remarks>See <see cref="MobileCRM.FetchXml.Fetch.execute">MobileCRM.FetchXml.Fetch.execute</see> for further details.</remarks>
        return new Promise(function (resolve, reject) {
            fetch.execute(
                output,
                resolve,
                function (error) {
                    reject(new Error(error));
                },
                scope);
        });
    },

    TabNames: {
        BRB_BookingTab: "Booking",
        TimeOffRequest_GeneralTab: "General"
    },

    Workflows: {
        authorizeConversation: "msdyn_AuthorizeConversation",
        getBingSpeechToken: "msdyn_GetBingSpeechToken"
    }
};