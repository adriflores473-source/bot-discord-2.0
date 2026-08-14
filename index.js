const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

// 1. Configuración de credenciales
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1531742804844216450';

// 2. Definición de comandos /slash
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Responde con Pong!'),
  new SlashCommandBuilder()
    .setName('hola')
    .setDescription('El bot te saluda amablemente'),
].map(command => command.toJSON());

// 3. Registrar los comandos en Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registrando comandos /slash globales...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('¡Comandos registrados con éxito!');
  } catch (error) {
    console.error('Error al registrar comandos:', error);
  }
})();

// 4. Inicializar cliente del bot
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', () => {
  console.log(`¡Bot iniciado como ${client.user.tag}!`);
});

// 5. Manejar la ejecución de los comandos /slash
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('¡Pong! 🏓');
  } else if (commandName === 'hola') {
    await interaction.reply(`¡Hola, <@${interaction.user.id}>! 👋`);
  }
});

client.login(process.env.DISCORD_TOKEN);
