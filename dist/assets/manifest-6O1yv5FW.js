const n=`{\r
  "Actions": [\r
    {\r
      "Icon": "Images/multiAction",\r
      "Name": "Multi Action",\r
      "States": [\r
        {\r
          "Image": "Images/btn_multiAction"\r
        }\r
      ],\r
      "Tooltip": "Execute multiple actions",\r
      "UUID": "com.elgato.streamdeck.multiactions.routine",\r
    "SupportedInMultiActions": false,\r
    "SupportedInKeyLogicActions": false\r
    },\r
    {\r
      "Icon": "Images/multiActionSwitch",\r
      "Name": "Multi Action Switch",\r
      "States": [\r
        {\r
          "Image": "Images/btn_toggleMultiActionOff"\r
        },\r
        {\r
          "Image": "Images/btn_toggleMultiActionOn"\r
        }\r
      ],\r
      "Tooltip": "Toggle between two Multi Action",\r
      "UUID": "com.elgato.streamdeck.multiactions.routine2",\r
    "SupportedInMultiActions": false,\r
    "SupportedInKeyLogicActions": false\r
    },\r
    {\r
      "Icon": "Images/randomMultiAction",\r
      "Name": "Random Action",\r
      "States": [\r
        {\r
          "Image": "Images/btn_randomAction"\r
        }\r
      ],\r
      "Tooltip": "Execute a random action",\r
      "UUID": "com.elgato.streamdeck.multiactions.random",\r
    "SupportedInMultiActions": false,\r
    "SupportedInKeyLogicActions": false\r
    },\r
    {\r
      "Icon": "Images/delay",\r
      "Name": "Delay",\r
      "States": [\r
        {\r
          "Image": "Images/btn_duration"\r
        }\r
      ],\r
      "Tooltip": "Pause the actions sequence",\r
      "UUID": "com.elgato.streamdeck.multiactions.delay",\r
    "SupportedInMultiActions": true,\r
    "SupportedInKeyLogicActions": false\r
    }\r
  ],\r
  "Author": "Elgato",\r
  "Description": "Multi Action",\r
  "Name": "Multi Action",\r
  "URL": "https://www.elgato.com/en/gaming/stream-deck",\r
  "PrivateAPI": true,\r
  "Version": "1.0"\r
}\r
`;export{n as default};
