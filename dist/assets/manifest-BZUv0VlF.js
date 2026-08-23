const n=`{\r
  "Actions": [\r
    {\r
      "Icon": "Images/dialStack",\r
      "Name": "Dial Stack",\r
      "States": [\r
        {\r
          "Image": "Images/btn_dialStack"\r
        }\r
      ], \r
      "Tooltip": "Combine multiple dials into a stack",\r
      "UUID": "com.elgato.streamdeck.dial.stack",\r
      "Controllers": ["Encoder"],\r
      "Encoder": {\r
        "layout": "$X2",\r
        "TriggerDescription": {\r
          "Push": "Switch to next action"\r
        }\r
      }\r
    }\r
  ], \r
  "Author": "Elgato", \r
  "Description": "Dials Actions",\r
  "Name": "Dials",\r
  "URL": "https://www.elgato.com/en/gaming/stream-deck", \r
  "PrivateAPI": true,\r
  "Version": "1.0"\r
}\r
`;export{n as default};
