const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// -------------------------------------------------------------
// CONFIGURACIÓN DE IDs Y TOKEN
// -------------------------------------------------------------
const LOG_CHANNEL_ID = '1537858405761552424';
const STAFF_ROLE_ID = '1532166214225494206'; 
const OWNER_ID = '1286812839465717772';       
const TOKEN = process.env.DISCORD_TOKEN;

// -------------------------------------------------------------
// REGISTRO AUTOMÁTICO DE COMANDOS AL ENCENDER
// -------------------------------------------------------------
const commands = [
    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Aísla temporalmente a un usuario')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a mutear').setRequired(true))
        .addStringOption(opt => opt.setName('duracion').setDescription('Duración (ej: 10m, 1h, 1d)').setRequired(true))
        .addStringOption(opt => opt.setName('razon').setDescription('Razón de la sanción').setRequired(true)),

    new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Quita el aislamiento a un usuario')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a desmutear').setRequired(true))
        .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(false)),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Banea a un usuario del servidor')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a banear').setRequired(true))
        .addStringOption(opt => opt.setName('razon').setDescription('Razón del baneo').setRequired(true)),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa a un usuario del servidor')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
        .addStringOption(opt => opt.setName('razon').setDescription('Razón de la expulsión').setRequired(true))
];

client.once('ready', async () => {
    console.log(`🤖 Bot encendido como: ${client.user.tag}`);

    // Registrar comandos automáticamente en Discord al iniciar
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('🔄 Sincronizando comandos con Discord...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ ¡Comandos cargados automáticamente!');
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
});

// -------------------------------------------------------------
// 1. FILTRO DE MALAS PALABRAS
// -------------------------------------------------------------
const badWords = [
    'mierda', 'carajo', 'maldito', 'bastardo', 'estupido', 'imbecil', 'tarado', 'retrasado', 'idiota', 'hdp',
    'inutil', 'subnormal', 'maricon', 'maldita', 'estupida', 'imbeciles', 'desgraciado', 'sorrete',
    'boludo', 'pelotudo', 'concha', 'conchuda', 'chupala', 'forro', 'orto', 'pajero', 'paja', 'gorreado', 
    'cagon', 'pija', 'choto', 'chota', 'forra', 'pelotuda', 'boluda', 'sorete', 'conchudo',
    'pendejo', 'pendeja', 'cabron', 'cabrona', 'verga', 'pinche', 'chinga', 'chingar', 'chingada', 'chingon',
    'culero', 'culera', 'joto', 'wuey', 'wey', 'mamon', 'mamona', 'putiza', 'pendejada',
    'joder', 'cono', 'polla', 'capullo', 'gilipollas', 'hostia', 'follar', 'capulla', 'gilipolla',
    'gonorrea', 'malparido', 'malparida', 'mamaguevo', 'weon', 'weona', 'culiao', 'culiada',
    'chuchatumadre', 'ctm', 'ptm', 'huevon', 'huevona', 'pichula', 'cojudo', 'cojuda',
    'noob', 'pvto', 'pvta', 'mrd', 'puto', 'puta'
];

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.toLowerCase();
    const hasBadWord = badWords.some(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(content) || content.includes(word);
    });

    if (hasBadWord) {
        try {
            await message.delete();
            const warningMsg = await message.channel.send(`⚠️ ${message.author}, por favor mantén el respeto y evita usar lenguaje inapropiado.`);
            setTimeout(() => warningMsg.delete().catch(() => {}), 5000);

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🚨 FILTRO DE PALABRAS PROHIBIDAS')
                    .setColor(0xE74C3C)
                    .addFields(
                        { name: 'Usuario', value: `${message.author} (${message.author.tag})`, inline: true },
                        { name: 'Canal', value: `${message.channel}`, inline: true },
                        { name: 'Mensaje borrado', value: `\`\`\`${message.content}\`\`\`` }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error en filtro:', error);
        }
    }
});

// -------------------------------------------------------------
// 2. COMANDOS DE MODERACIÓN
// -------------------------------------------------------------
function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    return null;
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, user: staff, member } = interaction;

    const isOwner = staff.id === OWNER_ID;
    const hasStaffRole = member.roles.cache.has(STAFF_ROLE_ID);

    if (!isOwner && !hasStaffRole) {
        return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
    }

    const targetUser = options.getUser('usuario');
    const reason = options.getString('razon') || 'Sin razón especificada';
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

    try {
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (commandName === 'mute') {
            const durationStr = options.getString('duracion');
            const ms = parseDuration(durationStr);
            if (!ms) return interaction.reply({ content: '❌ Duración inválida. Ej: `10m`, `1h`', ephemeral: true });
            if (!targetMember || !targetMember.moderatable) return interaction.reply({ content: '❌ No puedo mutear a este usuario.', ephemeral: true });

            await targetMember.timeout(ms, reason);
            await interaction.reply({ content: `✅ **${targetUser.tag}** fue muteado por ${durationStr}.`, ephemeral: true });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - MUTE')
                    .setColor(0xFFA500)
                    .addFields(
                        { name: 'Usuario sancionado', value: `${targetUser} (${targetUser.tag})`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Duración', value: durationStr, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        } else if (commandName === 'unmute') {
            if (!targetMember || !targetMember.isCommunicationDisabled()) return interaction.reply({ content: '❌ Este usuario no está muteado.', ephemeral: true });

            await targetMember.timeout(null, reason);
            await interaction.reply({ content: `✅ Se le quitó el mute a **${targetUser.tag}**.`, ephemeral: true });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - UNMUTE')
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: 'Usuario', value: `${targetUser} (${targetUser.tag})`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        } else if (commandName === 'ban') {
            if (!targetMember || !targetMember.bannable) return interaction.reply({ content: '❌ No puedo banear a este usuario.', ephemeral: true });

            await guild.members.ban(targetUser.id, { reason });
            await interaction.reply({ content: `✅ **${targetUser.tag}** fue baneado del servidor.`, ephemeral: true });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - BAN')
                    .setColor(0xE74C3C)
                    .addFields(
                        { name: 'Usuario baneado', value: `${targetUser} (${targetUser.tag})`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        } else if (commandName === 'kick') {
            if (!targetMember || !targetMember.kickable) return interaction.reply({ content: '❌ No puedo expulsar a este usuario.', ephemeral: true });

            await targetMember.kick(reason);
            await interaction.reply({ content: `✅ **${targetUser.tag}** fue expulsado del servidor.`, ephemeral: true });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - KICK')
                    .setColor(0xF1C40F)
                    .addFields(
                        { name: 'Usuario expulsado', value: `${targetUser} (${targetUser.tag})`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: '❌ Hubo un error al ejecutar el comando.', ephemeral: true });
    }
});

client.login(TOKEN);
