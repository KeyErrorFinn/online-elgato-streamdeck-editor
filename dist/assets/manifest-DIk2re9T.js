const n=`{\r
  "Actions": [\r
    {\r
      "Icon": "Images/keyStack",\r
      "Name": "Action Wheel",\r
      "States": [\r
        {\r
          "Image": "Images/btn_keyStack"\r
        }\r
      ],\r
      "Tooltip": "Assign multiple actions to a dial, then rotate to cycle through them",\r
      "UUID": "com.elgato.streamdeck.keys.stack",\r
      "Controllers": [\r
        "Encoder"\r
      ],\r
      "Encoder": {\r
        "layout": "$X2",\r
        "TriggerDescription": {\r
          "Rotate": "Navigate actions",\r
          "Push": "Execute action"\r
        }\r
      }\r
    },\r
    {\r
      "Icon": "Images/keyAdaptor",\r
      "Name": "Action Trigger",\r
      "States": [\r
        {\r
          "Image": "Images/btn_keyAdaptor"\r
        }\r
      ],\r
      "Tooltip": "Trigger actions with a dial turn",\r
      "UUID": "com.elgato.streamdeck.keys.adaptor",\r
      "Controllers": ["Encoder"],\r
      "Encoder": {\r
        "layout": "$X2"\r
      }\r
    },\r
    {\r
      "Icon": "Images/keyLogic",\r
      "Name": "Key Logic",\r
      "States": [\r
        {\r
          "Image": "Images/btn_keyLogic"\r
        }\r
      ],\r
      "Tooltip": "Trigger actions with key clicks",\r
      "UUID": "com.elgato.streamdeck.keys.logic",\r
      "Controllers": ["Keypad"],\r
      "SupportedInMultiActions": false,\r
      "SupportedInKeyLogicActions": false\r
    }\r
  ],\r
  "Author": "Elgato",\r
  "Description": "Key actions on dials",\r
  "Name": "Keys",\r
  "URL": "https://www.elgato.com/en/gaming/stream-deck",\r
  "PrivateAPI": true,\r
  "Version": "1.0"\r
}\r
`;export{n as default};
