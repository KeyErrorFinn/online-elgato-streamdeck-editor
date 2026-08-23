const r=`{\r
  "Actions": [\r
    {\r
      "Icon": "Images/brightness",\r
      "Name": "Brightness", \r
      "States": [\r
        {\r
          "Image": "Images/btn_keybrightness_max"\r
        }\r
      ], \r
      "Controllers": [ "Keypad", "Encoder" ],\r
      "Encoder":\r
      {\r
        "StackColor": "#e0dd3d",\r
        "layout": "$B1"\r
      },\r
      "Tooltip": "Adjust the brightness of your Stream Deck keys", \r
      "UUID": "com.elgato.streamdeck.system.keybrightness"\r
    }\r
  ], \r
  "Author": "Elgato", \r
  "Description": "Adjust the brightness of your Stream Deck keys", \r
  "Name": "Brightness", \r
  "URL": "https://www.elgato.com/en/gaming/stream-deck", \r
  "PrivateAPI": true,\r
  "Version": "1.0"\r
}\r
`;export{r as default};
