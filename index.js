const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');

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

// 2. Configurar cliente con Intenciones
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.once('ready', () => {
  console.log(`¡Bot iniciado exitosamente como ${client.user.tag}!`);
});

// ==========================================
// 3. LISTA AMPLIADA DE PALABRAS PROHIBIDAS
// ==========================================
const groserias = [
  // Generales e Insultos Comunes
  'mierda', 'carajo', 'maldito', 'bastardo', 'estupido', 'imbecil', 'tarado', 'retrasado', 'idiota', 'hdp',
  'inutil', 'subnormal', 'maricon', 'maldita', 'estupida', 'imbeciles', 'desgraciado', 'sorrete',

  // Argentina / Uruguay
  'boludo', 'pelotudo', 'concha', 'conchuda', 'chupala', 'forro', 'orto', 'pajero', 'paja', 'gorreado', 
  'cagon', 'pija', 'choto', 'chota', 'forra', 'pelotuda', 'boluda', 'sorete', 'conchudo',

  // México / Centroamérica
  'pendejo', 'pendeja', 'cabron', 'cabrona', 'verga', 'pinche', 'chinga', 'chingar', 'chingada', 'chingon',
  'culero', 'culera', 'joto', 'wuey', 'wey', 'mamon', 'mamona', 'putiza', 'pendejada',

  // España
  'joder', 'cono', 'polla', 'capullo', 'gilipollas', 'hostia', 'follar',  'capulla', 'gilipolla',

  // Colombia / Venezuela / Chile / Perú
  'gonorrea', 'malparido', 'malparida', 'mamaguevo', 'mamaguevo', 'weon', 'weona', 'culiao', 'culiada',
  'chuchatumadre', 'ctm', 'ptm', 'huevon', 'huevona', 'pichula', 'cojudo', 'cojuda',

  // Insultos comunes en Gaming / Redes
  'noob', 'pvto', 'pvta', 'mrd', 'puto', 'puta'
];

// ==========================================
// 4. DETECTOR DE MENSAJES Y RESPUESTA
// ==========================================
client.on('messageCreate', async (message) => {
  // Ignorar mensajes enviados por bots
  if (message.author.bot) return;

  // Normalizamos el texto: quitamos tildes, signos y saltos de línea
  const textoNormalizado = message.content
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, ' ');

  const palabras = textoNormalizado.split(/\s+/);

  const tieneGroseria = palabras.some(p => groserias.includes(p));

  if (tieneGroseria) {
    try {
      // Responde directamente al mensaje citándolo y etiquetando al usuario
      await message.reply(`⚠️ <@${message.author.id}>, cuidemos el lenguaje en el servidor.`);
    } catch (err) {
      console.error('Error al responder el mensaje:', err);
    }
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
