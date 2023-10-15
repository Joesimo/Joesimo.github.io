<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      background-color: #1a1a1a; /* Hellerer Hintergrund */
      color: white;
      font-family: Arial, sans-serif;
      text-align: center;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }

    #header {
      font-size: 10em; /* Doppelt so groß */
      margin-bottom: -20px; /* Mehr Abstand nach unten */
      text-shadow: 4px 4px 6px rgba(0, 0, 0, 0.8); /* Mehr Schattierung */
    }

    #percentage {
      font-size: 15em; /* Doppelt so groß */
      margin-bottom: 10px; /* Weniger Abstand nach unten */
      text-shadow: 8px 8px 10px rgba(0, 0, 0, 0.8); /* Mehr Schattierung */
    }

    #datetime {
      font-size: 2.5em; /* Kleiner */
      margin-bottom: -50px; /* Mehr Abstand nach unten */
    }

    #countdown {
      font-size: 1.5em; /* Etwas kleiner */
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8); /* Mehr Schattierung */
    }

    #randomText {
      bottom: 0px;
      font-size: 0.8em; /* Ziemlich klein */
    }
  </style>
</head>
<body>

  <div id="datetime"></div>
  <div id="header">27%</div>
  <div id="countdown">9999999</div>
  <div id="randomText"></div>

  <script>
    function updateDateTime() {
      const now = new Date();
      const day = ('0' + now.getDate()).slice(-2);
      const month = ('0' + (now.getMonth() + 1)).slice(-2);
      const year = now.getFullYear().toString().slice(-2);
      const hours = ('0' + now.getHours()).slice(-2);
      const minutes = ('0' + now.getMinutes()).slice(-2);

      document.getElementById('datetime').innerHTML = day + '.' + month + '.' + year + ' | ' + hours + ':' + minutes + ' Uhr';
    }

    function updateCountdown() {
      let countdown = localStorage.getItem('countdown') || 9999999;
      const percentage = document.getElementById('percentage');

      setInterval(function() {
        countdown--;
        localStorage.setItem('countdown', countdown);
        document.getElementById('countdown').innerHTML = countdown;

        if (countdown < 0) {
          countdown = 9999999;
          // Reduziere die Zahl um 1%
          let currentPercentage = parseInt(percentage.innerHTML);
          if (currentPercentage > 0) {
            currentPercentage--;
            percentage.innerHTML = currentPercentage + '%';
          }
        }
      }, 3); // Zählt insgesamt alle 5 Stunden auf 0 circa
    }

    function updateRandomText() {
      const textArray = [
        "Freddy, das ist eine wirklich große Zahl...",
        "Ach das ist doch schon wieder alles hier...",
        "FREEEEEEEEDERIK!",
        "Lust auf ein LoL Quiz?",
        "JuLis sind doof :P",
        "EU4?",
        "Hoher Gürtel.",
        "Wusstest du, dass sich alle 11 Stunden die Zahl um 1 veringert?",
        "Wusstest du, dass Freddy ein Zollbeamter ist?",
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ":)",
        "Hi Freddy.",
      ];

      // Zufälligen Text sofort anzeigen
      const randomIndex = Math.floor(Math.random() * textArray.length);
      document.getElementById('randomText').innerHTML = textArray[randomIndex];

      // Ändere den Text alle 10 Sekunden
      setInterval(function() {
        const randomIndex = Math.floor(Math.random() * textArray.length);
        document.getElementById('randomText').innerHTML = textArray[randomIndex];
      }, 10000);
    }

    updateDateTime();
    updateRandomText(); // Starte die Funktion für den zufälligen Text
    setTimeout(function() {
      updateCountdown();
      setInterval(updateDateTime, 1000); // Aktualisiere Datum und Uhrzeit jede Sekunde
    }, 0); // Starte den Countdown sofort
  </script>

</body>
</html>
