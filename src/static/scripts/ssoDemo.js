(function () {
    'use strict';

    var clientToken = "";
    var sharePointDomain = "";

    // 1. Get auth token
    // Ask Teams to get us a token from AAD
    function getClientSideToken() {

        return new Promise((resolve, reject) => {

            display("1. Get auth token from Microsoft Teams");

            microsoftTeams.authentication.getAuthToken({
                successCallback: (result) => {
                    display(result)
                    resolve(result);
                },
                failureCallback: function (error) {
                    reject("Error getting token: " + error);
                }
            });

        });

    }

    // 2. Exchange that token for a token with the required permissions
    //    using the web service (see /auth/token handler in app.js)
    function getServerSideToken(clientSideToken) {

        display("2. Exchange for server-side graph token");

        return new Promise((resolve, reject) => {

            microsoftTeams.getContext((context) => {

                console.log(context);

                fetch('/auth/token', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'tid': context.tid,
                        'token': clientSideToken,
                        'scopes': ["https://graph.microsoft.com/User.Read"],
                    }),
                    mode: 'cors',
                    cache: 'default'
                })
                .then((response) => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        reject(response.error);
                    }
                })
                .then((responseJson) => {
                    if (responseJson.error) {
                        reject(responseJson.error);
                    } else {
                        const serverSideToken = responseJson;
                        display(serverSideToken);
                        resolve(serverSideToken);
                    }
                });
            });
        });
    }

    function getSharePointToken(clientSideToken) {

        display("4. Exchange for server-side SharePoint token");

        return new Promise((resolve, reject) => {

            microsoftTeams.getContext((context) => {

                sharePointDomain = `https://${context.teamSiteDomain}`;

                fetch('/auth/token', {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'tid': context.tid,
                        'token': clientSideToken,
                        'scopes': [`https://${context.teamSiteDomain}/AllSites.Read`],
                    }),
                    mode: 'cors',
                    cache: 'default'
                })
                .then((response) => {
                    if (response.ok) {
                        return response.json();
                    } else {
                        reject(response.error);
                    }
                })
                .then((responseJson) => {
                    if (responseJson.error) {
                        reject(responseJson.error);
                    } else {
                        const serverSideToken = responseJson;
                        display(serverSideToken);
                        resolve(serverSideToken);
                    }
                });
            });
        });
    }

    // 3. Get the server side token and use it to call the Graph API
    function useServerSideToken(data) {

        display("3. Call https://graph.microsoft.com/v1.0/me/ with the server side token");

        return fetch("https://graph.microsoft.com/v1.0/me/",
            {
                method: 'GET',
                headers: {
                    "accept": "application/json",
                    "authorization": "bearer " + data
                },
                mode: 'cors',
                cache: 'default'
            })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw (`Error ${response.status}: ${response.statusText}`);
                }
            })
            .then((profile) => {
                display(JSON.stringify(profile, undefined, 4), 'pre');
            });

    }

    function useSharePointToken(token){
        display("5. Use SharePoint token");

        return fetch(`${sharePointDomain}/_api/web`,
            {
                method: 'GET',
                headers: {
                    "accept": "application/json",
                    "authorization": "bearer " + token
                },
                mode: 'cors',
                cache: 'default'
            })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw (`Error ${response.status}: ${response.statusText}`);
                }
            })
            .then((web) => {
                display(JSON.stringify(web, undefined, 4), 'pre');
            });
    }

    // Show the consent pop-up
    function requestConsent() {
        return new Promise((resolve, reject) => {
            microsoftTeams.authentication.authenticate({
                url: window.location.origin + "/auth/auth-start",
                width: 600,
                height: 535,
                successCallback: (result) => {
                    let data = localStorage.getItem(result);
                    localStorage.removeItem(result);
                    resolve(data);
                },
                failureCallback: (reason) => {
                    reject(JSON.stringify(reason));
                }
            });
        });
    }

    // Add text to the display in a <p> or other HTML element
    function display(text, elementTag) {
        var logDiv = document.getElementById('logs');
        var p = document.createElement(elementTag ? elementTag : "p");
        p.innerText = text;
        logDiv.append(p);
        console.log("ssoDemo: " + text);
        return p;
    }

    // In-line code
    getClientSideToken()
        .then((clientSideToken) => {
            clientToken = clientSideToken;
            return getServerSideToken(clientSideToken);
        })
        .then((serverSideToken) => {
            return useServerSideToken(serverSideToken);
        })
        .then(() => {
            return getSharePointToken(clientToken)
        })
        .then((sharePointToken) => {
            return useSharePointToken(sharePointToken);
        })
        .catch((error) => {
            if (error === "invalid_grant") {
                display(`Error: ${error} - user or admin consent required`);
                // Display in-line button so user can consent
                let button = display("Consent", "button");
                button.onclick = (() => {
                    requestConsent()
                        .then((result) => {

                            let data = JSON.parse(result);

                            display(JSON.stringify(data, undefined, 4), 'pre');
                            
                            // Consent succeeded - use the token we got back
                            // let accessToken = data.accessToken;
                            // display(`Received access token ${accessToken}`);
                            // useServerSideToken(accessToken);

                            let refreshButton = display("Refresh page", "button");
                            refreshButton.onclick = (() => { window.location.reload(); });
                        })
                        .catch((error) => {
                            display(`ERROR ${error}`);
                            // Consent failed - offer to refresh the page
                            button.disabled = true;
                            let refreshButton = display("Refresh page", "button");
                            refreshButton.onclick = (() => { window.location.reload(); });
                        });
                });
            } else {
                // Something else went wrong
                display(`Error from web service: ${error}`);
            }
        });

})();
