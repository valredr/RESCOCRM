window.open = function (open) {
    /// <summary>
    /// Override window.open to open default phone map app to show navigation route for users if the url is bing map url.
    /// Otherwise, the default behavior of our app will open the browser to just show the destination which is not a route and 
    /// doesn't mean a lot to users.
    /// </summary>
    return FS.BotChatLoader.navigateTo;
}(window.open);
