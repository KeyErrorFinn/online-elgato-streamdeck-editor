const r=`{\r
  "Actions": [\r
    {\r
      "Icon": "Images/trigger_assert_white", \r
      "Name": "Assert", \r
      "States": [\r
        {\r
          "Image": "Images/btn_trigger_assert"\r
        }\r
      ], \r
      "Controllers": [ "Keypad", "Encoder" ],\r
      "Encoder":\r
      {\r
        "layout": "layout.json"\r
      },\r
      "Tooltip": "Trap assertion", \r
      "UUID": "com.elgato.streamdeck.system.assert"\r
    }\r
  ], \r
  "Author": "Elgato", \r
  "Description": "Trap assertion", \r
  "Name": "Trap assertion", \r
  "URL": "https://www.elgato.com/en/gaming/stream-deck", \r
  "PrivateAPI": true,\r
  "Version": "1.0"\r
}\r
`;export{r as default};
