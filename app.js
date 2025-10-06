// app.js

const express = require('express');
const bodyParser = require('body-parser');
const fca = require('ws3-fca'); 
const { loadConfigAndState, saveConfig, getConfig, stopBotByTaskID, setCurrentApiInstance } = require('./botConfig');
const { handleCommands } = require('./commands');
const { handleThreadNameChange, handleNicknameChange } = require('./handlers');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// --- Global State ---
const BOT_INIT_RETRY_DELAY = 15000; // 15 seconds

// ----------------- PANEL (WEB UI) -----------------
app.get('/', (req, res) => {
    const config = getConfig();
    const taskID = config.taskID;
    const taskIDDisplay = taskID 
        ? `<div id="taskIdDisplay"><p><strong>TASK ID:</strong><br>${taskID}</p><small>Use this ID to stop the bot.</small></div>` 
        : '<p style="color:#ffcc00; font-weight: 600;">Bot is not running or credentials are not set.</p>';

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AXSHU B0T 👽</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');

            :root {
                --neon-blue: #00ffff;
                --neon-pink: #ff00ff;
                --neon-yellow: #ffcc00;
                --dark-bg: #0d0d0d;
                --panel-bg: rgba(10, 10, 10, 0.8);
                --input-bg: #1a1a1a;
            }

            body {
                background-color: var(--dark-bg);
                color: #e0e0e0;
                font-family: 'Montserrat', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 40px 0;
                margin: 0;
                overflow-x: hidden;
                position: relative;
                animation: background-glow 15s infinite alternate ease-in-out;
            }

            @keyframes background-glow {
                from { box-shadow: inset 0 0 50px rgba(0, 255, 255, 0.2); }
                to { box-shadow: inset 0 0 100px rgba(255, 0, 255, 0.2); }
            }

            .container {
                width: 90%;
                max-width: 500px;
                padding: 30px;
                background-color: var(--panel-bg);
                border-radius: 15px;
                text-align: center;
                backdrop-filter: blur(8px);
                border: 1px solid var(--neon-blue);
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.6), 0 0 60px rgba(0, 255, 255, 0.3);
                position: relative;
                z-index: 1;
            }
            
            .container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    120deg, transparent, rgba(0, 255, 255, 0.2), transparent, rgba(255, 0, 255, 0.2)
                );
                animation: running-lights 4s infinite linear;
                z-index: -1;
            }

            @keyframes running-lights {
                0% { transform: translate(-100%, -100%); }
                100% { transform: translate(100%, 100%); }
            }

            h1 {
                font-family: 'Montserrat', sans-serif;
                font-size: 2.5em;
                font-weight: 700;
                margin-bottom: 25px;
                color: var(--neon-blue);
                text-shadow: 0 0 10px var(--neon-blue), 0 0 20px var(--neon-blue), 0 0 30px var(--neon-blue);
            }

            .form-group {
                margin-bottom: 20px;
                text-align: left;
            }
            label {
                display: block;
                margin-bottom: 8px;
                font-size: 0.9em;
                color: var(--neon-blue);
                text-align: left;
                text-shadow: 0 0 5px var(--neon-blue);
                font-weight: 600;
            }
            input[type="text"],
            textarea {
                width: calc(100% - 20px);
                padding: 10px;
                border: 1px solid var(--neon-blue);
                background-color: var(--input-bg);
                color: var(--neon-blue);
                border-radius: 8px;
                font-size: 1em;
                outline: none;
                box-shadow: 0 0 8px rgba(0, 255, 255, 0.4);
                transition: all 0.3s ease;
            }
            textarea {
                resize: vertical;
                height: 120px;
            }
            input:focus, textarea:focus {
                border-color: var(--neon-pink);
                box-shadow: 0 0 15px rgba(255, 0, 255, 0.7);
            }

            .button {
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-size: 1em;
                cursor: pointer;
                text-transform: uppercase;
                font-weight: 700;
                margin-bottom: 15px;
                transition: all 0.3s ease;
                text-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
            }
            .button.blue {
                background-color: var(--neon-blue);
                color: #0a0a0a;
                box-shadow: 0 0 15px rgba(0, 255, 255, 0.7);
            }
            .button.blue:hover {
                background-color: #00e0e0;
                box-shadow: 0 0 25px rgba(0, 255, 255, 0.9), 0 0 40px rgba(0, 255, 255, 0.6);
                transform: translateY(-2px);
            }
            .button.red {
                background-color: var(--neon-pink);
                color: #0a0a0a;
                box-shadow: 0 0 15px rgba(255, 0, 255, 0.7);
            }
            .button.red:hover {
                background-color: #e000e0;
                box-shadow: 0 0 25px rgba(255, 0, 255, 0.9), 0 0 40px rgba(255, 0, 255, 0.6);
                transform: translateY(-2px);
            }

            .instructions {
                margin-top: 25px;
                padding: 15px;
                border-radius: 8px;
                background-color: rgba(20, 20, 20, 0.9);
                border: 1px solid var(--neon-yellow);
                text-align: left;
            }
            .instructions h3 {
                color: var(--neon-yellow);
                text-shadow: 0 0 10px rgba(255, 204, 0, 0.7);
                margin-top: 0;
            }
            .instructions p {
                font-size: 0.85em;
                color: #ccc;
                margin: 5px 0;
            }
            .instructions strong {
                color: var(--neon-blue);
                text-shadow: 0 0 5px rgba(0, 255, 255, 0.7);
            }
            
            #taskIdDisplay {
                margin-bottom: 20px;
                padding: 15px;
                border-radius: 8px;
                background-color: rgba(30, 30, 30, 0.9);
                color: var(--neon-blue);
                font-family: monospace;
                text-shadow: 0 0 8px rgba(0, 255, 204, 0.7);
                border: 1px solid var(--neon-blue);
                box-shadow: 0 0 10px rgba(0, 255, 204, 0.5);
            }
            #taskIdDisplay strong {
                font-size: 1.1em;
            }

            /* Footer Style */
            .footer {
                margin-top: 30px;
                font-size: 0.75em;
                color: #888;
                text-shadow: 0 0 5px rgba(136, 136, 136, 0.5);
            }
            .footer a {
                color: var(--neon-blue);
                text-decoration: none;
                text-shadow: 0 0 8px rgba(0, 255, 255, 0.8);
                transition: text-shadow 0.3s ease;
            }
            .footer a:hover {
                text-shadow: 0 0 15px rgba(0, 255, 255, 1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>AXSHU BOT CONFIGURATION</h1>

            ${taskIDDisplay}

            <form id="configForm">
                <div class="form-group">
                    <label for="cookies">Facebook AppState (JSON):</label>
                    <textarea id="cookies" name="cookies" required placeholder='Paste your Facebook appState JSON here (the appState array/object)'></textarea>
                </div>
                <div class="form-group">
                    <label for="prefix">Bot Prefix:</label>
                    <input type="text" id="prefix" name="prefix" value="+" required>
                </div>
                <div class="form-group">
                    <label for="adminID">Admin Facebook ID:</label>
                    <input type="text" id="adminID" name="adminID" required placeholder="Your Facebook user ID">
                </div>
                <button type="submit" class="button blue">Save & Start Bot 🚀</button>
            </form>

            <hr style="border-color: rgba(0, 255, 255, 0.3); margin: 30px 0;">
            
            <form id="stopForm">
                <div class="form-group">
                    <label for="stopTaskID">ENTER TASK ID TO STOP:</label>
                    <input type="text" id="stopTaskID" name="stopTaskID" required placeholder="Paste the unique Task ID here">
                </div>
                <button type="submit" class="button red">STOP BOT SERVICE 🛑</button>
            </form>
            
            <div class="instructions">
                <h3>Bot Commands (in group chat)</h3>
                <p><strong>group on &lt;name&gt;</strong> — lock group name (admin only)</p>
                <p><strong>group off</strong> — unlock group name (admin only)</p>
                <p><strong>nickname on &lt;nick&gt;</strong> — lock all nicknames to &lt;nick&gt; (admin only)</p>
                <p><strong>nickname off</strong> — unlock nicknames (admin only)</p>
                <p><strong>tid</strong> — show thread ID</p>
                <p><strong>uid [@mention]</strong> — show UID for mention or your UID</p>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} D3V3L0P3D WITH ❤️ BY AXSHU</p>
                <p>
                    AXSHU RAJPUT <a href="https://www.facebook.com/profile.php?id=61574791744025" target="_blank">CLICK HERE FOR FACEBOOK</a>
                </p>
                <p>💬 <a href="#">CHAT ON WHATSAPP</a></p>
            </div>
        </div>
        
        <script>
            // CONFIG FORM SCRIPT
            document.getElementById('configForm').addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(this);
                const data = {
                    cookies: formData.get('cookies'),
                    prefix: formData.get('prefix'),
                    adminID: formData.get('adminID')
                };

                fetch('/configure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(response => response.text())
                .then(message => {
                    alert(message);
                    window.location.reload(); // Reload to show new Task ID
                })
                .catch(error => {
                    console.error('Configuration Error:', error);
                    alert('An error occurred during configuration. Check console.');
                });
            });

            // STOP FORM SCRIPT
            document.getElementById('stopForm').addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(this);
                const taskID = formData.get('stopTaskID');

                fetch('/stopbot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskID: taskID })
                })
                .then(response => response.text())
                .then(message => {
                    alert(message);
                    window.location.reload(); // Reload to show status change
                })
                .catch(error => {
                    console.error('Stop Bot Error:', error);
                    alert('An error occurred while stopping the bot. Check console.');
                });
            });
        </script>
    </body>
    </html>
    `);
});

app.post('/configure', (req, res) => {
  try {
    const configData = req.body;
    
    // cookies could be an array/object — parse JSON
    const cookies = JSON.parse(configData.cookies);
    const prefix = configData.prefix || '/devil';
    const adminID = configData.adminID;

    // Save config first, which generates the Task ID
    saveConfig({ cookies, prefix, adminID });

    res.send('Bot configured successfully! Starting...');
    initializeBot();
  } catch (e) {
    console.error('Configuration error:', e);
    res.status(400).send('Error: Invalid configuration. Please check your input.');
  }
});

// NEW: Stop Bot Endpoint
app.post('/stopbot', (req, res) => {
    const inputTaskID = req.body.taskID;

    if (!inputTaskID) {
        return res.status(400).send('Error: Task ID missing.');
    }
    
    const stopped = stopBotByTaskID(inputTaskID);

    if (stopped) {
        res.send('Success: Bot has been stopped.');
    } else {
        res.status(400).send('Error: Invalid Task ID or bot is already stopped.');
    }
});


// ----------------- START/RESTORE -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (loadConfigAndState()) {
    console.log('Loaded saved configuration. Initializing bot...');
    initializeBot();
  } else {
    console.log('No saved configuration found. Open panel to configure the bot.');
  }
});


// ----------------- BOT INITIALIZATION (WITH RE-LOGIN LOGIC) -----------------
async function initializeBot() {
  const config = getConfig();
  
  // Clear any existing bot API instance
  if (config.activeBots && config.activeBots[config.adminID]) {
      try { config.activeBots[config.adminID].stopListening(); } catch(e) {}
      delete config.activeBots[config.adminID];
  }

  if (!config.cookies || !config.adminID) {
    console.log('Bot not initialized: cookies or adminID missing in config.');
    return;
  }

  console.log('Initializing bot with WS3-FCA...');

  try {
    const api = await fca({ appState: config.cookies }); 
    config.activeBots[config.adminID] = api;
    
    // Set the API instance globally for stopping
    setCurrentApiInstance(api); 

    api.setOptions({
      selfListen: true,
      listenEvents: true,
      updatePresence: false
    });

    // listen to events
    api.listen(async (err, event) => {
      if (err) {
          console.error('Listen error:', err);
          
          if (err.error === 'Not logged in' || err.error === 'Request failed') { 
              console.log(`❌ Login expired/failed. Retrying in ${BOT_INIT_RETRY_DELAY / 1000} seconds...`);
              // Clear current API before retrying
              if (config.activeBots[config.adminID]) {
                  try { config.activeBots[config.adminID].stopListening(); } catch(e) {}
                  delete config.activeBots[config.adminID];
              }
              setTimeout(initializeBot, BOT_INIT_RETRY_DELAY);
              return;
          }
          return;
      }
      
      const { threadID, senderID, body, mentions } = event;
      
      // Handle events
      if (event.type === 'message' || event.type === 'message_reply') {
        // Simple Mention Check
        if (mentions && Object.keys(mentions).some(k => String(mentions[k].id) === String(config.adminID))) {
            try { await api.sendMessage("Hello! I'm the group bot. Use commands like 'tid' or 'group on <name>'.", threadID); } catch (e) {}
        }
        
        if (body) {
            await handleCommands(api, event);
        }
      } else if (event.type === 'change_thread_name') {
        await handleThreadNameChange(api, event);
      } else if (event.type === 'change_nickname') {
        await handleNicknameChange(api, event);
      }
    });

    console.log('✅ Bot is now listening for events...');
  } catch (err) {
    console.error('❌ Login/Init error:', err);
    console.log(`❌ Failed to log in. Retrying in ${BOT_INIT_RETRY_DELAY / 1000} seconds...`);
    setTimeout(initializeBot, BOT_INIT_RETRY_DELAY); // Retry after delay
  }
}
