const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1531742804844216450';

// 1. Registrar comandos /slash
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Responde con Pong!'),
  new SlashCommandBuilder().setName('hola').setDescription('El bot te saluda amablemente'),
].map(command => command.toJSON());

if (TOKEN) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  (async () => {
    try {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    } catch (error) {
      console.error('Error al registrar comandos:', error);
    }
  })();
}

// 2. Configurar permisos del Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.once('ready', () => {
  console.log(`¡Bot iniciado exitosamente como ${client.user.tag}!`);
});

// ==========================================
// 3. LISTA EXTENSA DE PALABRAS PROHIBIDAS
// ==========================================
const groserias = [
  // Generales / Neutras
  'mierda', 'carajo', 'maldito', 'bastardo', 'estupido', 'imbecil', 'tarado', 'retrasado', 'idiota', 'hdp',

  // Argentina / Uruguay
  'boludo', 'pelotudo', 'concha', 'conchuda', 'chupala', 'forro', 'orto', 'pajero', 'paja', 'gorreado', 'cagón', 'pija',

  // México / Centroamérica
  'pendejo', 'cabron', 'verga', 'pinche', 'chinga', 'chingar', 'chingada', 'culero', 'joto', 'wuey', 'wey',

  // España
  'joder', 'coño', 'polla', 'capullo', 'gilipollas', 'hostia', 'follar', 'ostia',

  // Colombia / Venezuela / Chile / Perú
  'gonorrea', 'malparido', 'mamaguevo', 'mamaguevo', 'weon', 'maldita', 'culiao', 'chuchatumadre', 'ctm', 'ptm'
];

// ==========================================
// 4. DETECTOR DE GROSERÍAS INTELIGENTE
// ==========================================
client.on('messageCreate', async (message) => {
  // Ignorar si el mensaje proviene de un bot
  if (message.author.bot) return;

  // Convertimos a minúsculas y limpiamos signos de puntuación (comas, puntos, signos de exclamación)
  const textoLimpio = message.content
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, '');

  // Separamos el texto en palabras individuales
  const palabrasEnMensaje = textoLimpio.split(/\s+/);

  // Verificamos si alguna palabra de la lista coincide exactamente con una del mensaje
  const contieneGroseria = palabrasEnMensaje.some(palabra => groserias.includes(palabra));

  if (contieneGroseria) {
    // 1. Borra el mensaje grosero (requiere que el bot tenga permiso "Administrar Mensajes")
    try {
      await message.delete();
    } catch (error) {
      console.log('No se pudo borrar el mensaje (asegúrate de que el bot tenga permisos).');
    }

    // 2. Le envía una advertencia al usuario
    await message.channel.send(`⚠️ <@${message.author.id}>, por favor mantengamos el respeto en el servidor. Tu mensaje fue eliminado.`);
  }
});

// 5. Respuestas a comandos /slash
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  if (commandName === 'ping') await interaction.reply('¡Pong! 🏓');
  else if (commandName === 'hola') await interaction.reply(`¡Hola, <@${interaction.user.id}>! 👋`);
});

client.login(TOKEN);
