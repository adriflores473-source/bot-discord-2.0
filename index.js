const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// -------------------------------------------------------------
// CONFIGURACIÓN DE IDs Y TOKEN
// -------------------------------------------------------------
const STAFF_ROLE_ID = '1532166214225494206';       // Rol de Staff
const OWNER_ID = '1286812839465717772';             // Tu ID (Marcos)
const USER_ROLE_TO_LOCK = '1532166292130500648';    // Rol a bloquear
const TOKEN = process.env.DISCORD_TOKEN;

// Guardado dinámico de configuración de logs por servidor
const logChannels = {}; 
// Imagen de bienvenida de Pinterest
const WELCOME_BACKGROUND_URL = 'https://i.pinimg.com/1200x/c6/f9/2f/c6f92f691b52ca0967ce7a3705ef776d.jpg';

// -------------------------------------------------------------
// REGISTRO DE COMANDOS SLASH
// -------------------------------------------------------------
const commands = [
    new SlashCommandBuilder()
        .setName('setlogs')
        .setDescription('Configura el canal para los registros de moderación y eventos')
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal donde se enviarán los logs').setRequired(true))
        .addStringOption(opt => opt.setName('tipo').setDescription('Selecciona qué tipo de eventos registrar')
            .setRequired(true)
            .addChoices(
                { name: '🌐 Todos los logs (Incluye Bienvenidas)', value: 'todos_los_logs' },
                { name: '🛑 Todos menos Bienvenida', value: 'todos_menos_bienvenida' },
                { name: '🖼️ Solo Bienvenida con Imagen', value: 'bienvenida_imagen' },
                { name: '🔨 Solo Sanciones/Moderación', value: 'logs_bans' },
                { name: '🎙️ Solo Canales y Voz', value: 'logs_canales' },
                { name: '🎭 Solo Gestión de Roles', value: 'logs_roles' }
            )),

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
        .addStringOption(opt => opt.setName('razon').setDescription('Razón de la expulsión').setRequired(true)),

    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Bloquea el canal actual')
        .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(false)),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Desbloquea el canal actual')
        .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(false)),

    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Establece el modo lento en el canal')
        .addIntegerOption(opt => opt.setName('segundos').setDescription('Segundos de espera').setRequired(true))
        .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(false)),

    new SlashCommandBuilder()
        .setName('disablecommands')
        .setDescription('Desactiva comandos en el canal')
        .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(false)),

    new SlashCommandBuilder()
        .setName('enablecommands')
        .setDescription('Habilita comandos en el canal')
        .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(false)),

    new SlashCommandBuilder()
        .setName('cleanchat')
        .setDescription('Elimina una cantidad de mensajes')
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad (1 - 100)').setRequired(true)),

    new SlashCommandBuilder()
        .setName('clearuser')
        .setDescription('Borra únicamente los mensajes de un usuario')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario').setRequired(true))
        .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de mensajes a revisar (1 - 100)').setRequired(true))
];

client.once('ready', async () => {
    console.log(`🤖 Bot encendido como: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Comandos registrados con éxito.');
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
});

// Función para obtener el canal de logs según la categoría configurada
function getLogChannel(guildId, category) {
    const config = logChannels[guildId];
    if (!config) return null;
    if (config.types.includes('todos_los_logs')) return config.channelId;
    if (config.types.includes('todos_menos_bienvenida') && category !== 'bienvenida_imagen') return config.channelId;
    if (config.types.includes(category)) return config.channelId;
    return null;
}

// -------------------------------------------------------------
// SISTEMA DE TARJETA DE BIENVENIDA CON CANVAS
// -------------------------------------------------------------
client.on('guildMemberAdd', async (member) => {
    const channelId = getLogChannel(member.guild.id, 'bienvenida_imagen');
    if (!channelId) return;

    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;

    try {
        const canvas = createCanvas(1200, 675);
        const ctx = canvas.getContext('2d');

        // Fondo
        const background = await loadImage(WELCOME_BACKGROUND_URL);
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Capa oscura para legibilidad
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Borde circular del Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(600, 230, 105, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Recorte circular para el Avatar
        ctx.beginPath();
        ctx.arc(600, 230, 100, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarURL);
        ctx.drawImage(avatar, 500, 130, 200, 200);
        ctx.restore();

        // Textos
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('¡BIENVENIDO/A!', 600, 420);

        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#00FFFF';
        ctx.fillText(member.user.tag, 600, 480);

        ctx.font = '30px sans-serif';
        ctx.fillStyle = '#E0E0E0';
        ctx.fillText(`Eres el miembro #${member.guild.memberCount}`, 600, 540);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'bienvenida.png' });
        await channel.send({ content: `👋 ¡Bienvenido/a al servidor ${member}!`, files: [attachment] });

    } catch (error) {
        console.error('Error al generar la tarjeta de bienvenida:', error);
    }
});

// -------------------------------------------------------------
// EVENTOS DE LOGS DE CANALES Y VOZ
// -------------------------------------------------------------
client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const logId = getLogChannel(channel.guild.id, 'logs_canales');
    if (!logId) return;
    const logChannel = channel.guild.channels.cache.get(logId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('📁 CANAL CREADO')
        .setColor(0x2ECC71)
        .addFields(
            { name: 'Nombre', value: channel.name, inline: true },
            { name: 'Tipo', value: `${channel.type}`, inline: true }
        )
        .setTimestamp();
    await logChannel.send({ embeds: [embed] });
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const logId = getLogChannel(channel.guild.id, 'logs_canales');
    if (!logId) return;
    const logChannel = channel.guild.channels.cache.get(logId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ CANAL ELIMINADO')
        .setColor(0xE74C3C)
        .addFields({ name: 'Nombre', value: channel.name, inline: true })
        .setTimestamp();
    await logChannel.send({ embeds: [embed] });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = newState.guild || oldState.guild;
    const logId = getLogChannel(guild.id, 'logs_canales');
    if (!logId) return;
    const logChannel = guild.channels.cache.get(logId);
    if (!logChannel) return;

    const member = newState.member || oldState.member;

    if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🎙️ CONEXIÓN A VOZ')
            .setColor(0x3498DB)
            .setDescription(`${member} se conectó al canal **${newState.channel.name}**`)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } else if (oldState.channelId && !newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🎙️ DESCONEXIÓN DE VOZ')
            .setColor(0x95A5A6)
            .setDescription(`${member} se desconectó de **${oldState.channel.name}**`)
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
    }
});

// -------------------------------------------------------------
// EVENTOS DE LOGS DE ROLES
// -------------------------------------------------------------
client.on('roleCreate', async (role) => {
    const logId = getLogChannel(role.guild.id, 'logs_roles');
    if (!logId) return;
    const logChannel = role.guild.channels.cache.get(logId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🎭 ROL CREADO')
        .setColor(0x9B59B6)
        .addFields({ name: 'Nombre del Rol', value: role.name, inline: true })
        .setTimestamp();
    await logChannel.send({ embeds: [embed] });
});

client.on('roleDelete', async (role) => {
    const logId = getLogChannel(role.guild.id, 'logs_roles');
    if (!logId) return;
    const logChannel = role.guild.channels.cache.get(logId);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🎭 ROL ELIMINADO')
        .setColor(0xE74C3C)
        .addFields({ name: 'Nombre del Rol', value: role.name, inline: true })
        .setTimestamp();
    await logChannel.send({ embeds: [embed] });
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logId = getLogChannel(newMember.guild.id, 'logs_roles');
    if (!logId) return;
    const logChannel = newMember.guild.channels.cache.get(logId);
    if (!logChannel) return;

    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0) {
        addedRoles.forEach(async role => {
            const embed = new EmbedBuilder()
                .setTitle('🎭 ROL ASIGNADO')
                .setColor(0x2ECC71)
                .addFields(
                    { name: 'Usuario', value: `${newMember} (${newMember.user.tag})`, inline: true },
                    { name: 'Rol agregado', value: role.name, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        });
    }

    if (removedRoles.size > 0) {
        removedRoles.forEach(async role => {
            const embed = new EmbedBuilder()
                .setTitle('🎭 ROL RETIRADO')
                .setColor(0xE74C3C)
                .addFields(
                    { name: 'Usuario', value: `${newMember} (${newMember.user.tag})`, inline: true },
                    { name: 'Rol removido', value: role.name, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        });
    }
});

// -------------------------------------------------------------
// FILTRO AUTOMÁTICO DE PALABRAS PROHIBIDAS
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

            const logId = getLogChannel(message.guild.id, 'logs_bans');
            if (logId) {
                const logChannel = message.guild.channels.cache.get(logId);
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
            }
        } catch (error) {
            console.error('Error en filtro:', error);
        }
    }
});

// -------------------------------------------------------------
// EJECUCIÓN DE COMANDOS DE MODERACIÓN Y CONFIGURACIÓN
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

    const { commandName, options, guild, user: staff, member, channel } = interaction;
    const isOwner = staff.id === OWNER_ID;
    const hasStaffRole = member.roles.cache.has(STAFF_ROLE_ID);

    if (!isOwner && !hasStaffRole) {
        return interaction.reply({ content: '❌ No tienes permisos para usar este comando.', ephemeral: true });
    }

    const reason = options.getString('razon') || 'Sin razón especificada';
    const logId = getLogChannel(guild.id, 'logs_bans');
    const logChannel = logId ? guild.channels.cache.get(logId) : null;

    try {
        // --- /SETLOGS ---
        if (commandName === 'setlogs') {
            const targetChannel = options.getChannel('canal');
            const logType = options.getString('tipo');

            logChannels[guild.id] = {
                channelId: targetChannel.id,
                types: [logType]
            };

            await interaction.reply({ content: `✅ Canal ${targetChannel} configurado con éxito para registrar **${logType}**.` });

        // --- /MUTE ---
        } else if (commandName === 'mute') {
            const targetUser = options.getUser('usuario');
            const durationStr = options.getString('duracion');
            const ms = parseDuration(durationStr);
            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

            if (!ms) return interaction.reply({ content: '❌ Duración inválida. Ej: `10m`, `1h`', ephemeral: true });
            if (!targetMember || !targetMember.moderatable) return interaction.reply({ content: '❌ No puedo mutear a este usuario.', ephemeral: true });

            await targetMember.timeout(ms, reason);
            await interaction.reply({ content: `🤐 **${targetUser.tag}** fue muteado por **${durationStr}** por ${staff}.\n**Razón:** ${reason}` });

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

        // --- /UNMUTE ---
        } else if (commandName === 'unmute') {
            const targetUser = options.getUser('usuario');
            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember || !targetMember.isCommunicationDisabled()) return interaction.reply({ content: '❌ Este usuario no está muteado.', ephemeral: true });

            await targetMember.timeout(null, reason);
            await interaction.reply({ content: `🔊 Se le retiró el mute a **${targetUser.tag}** por ${staff}.\n**Razón:** ${reason}` });

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

        // --- /BAN ---
        } else if (commandName === 'ban') {
            const targetUser = options.getUser('usuario');
            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember || !targetMember.bannable) return interaction.reply({ content: '❌ No puedo banear a este usuario.', ephemeral: true });

            await guild.members.ban(targetUser.id, { reason });
            await interaction.reply({ content: `⛔ **${targetUser.tag}** fue baneado por ${staff}.\n**Razón:** ${reason}` });

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

        // --- /KICK ---
        } else if (commandName === 'kick') {
            const targetUser = options.getUser('usuario');
            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

            if (!targetMember || !targetMember.kickable) return interaction.reply({ content: '❌ No puedo expulsar a este usuario.', ephemeral: true });

            await targetMember.kick(reason);
            await interaction.reply({ content: `👢 **${targetUser.tag}** fue expulsado por ${staff}.\n**Razón:** ${reason}` });

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

        // --- /LOCK ---
        } else if (commandName === 'lock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            await channel.permissionOverwrites.edit(USER_ROLE_TO_LOCK, { SendMessages: false }).catch(() => {});

            await interaction.reply({ content: `🔒 **Canal bloqueado** por ${staff}.\n**Razón:** ${reason}` });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - LOCK')
                    .setColor(0x95A5A6)
                    .addFields(
                        { name: 'Canal bloqueado', value: `${channel}`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        // --- /UNLOCK ---
        } else if (commandName === 'unlock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            await channel.permissionOverwrites.edit(USER_ROLE_TO_LOCK, { SendMessages: null }).catch(() => {});

            await interaction.reply({ content: `🔓 **Canal desbloqueado** por ${staff}.\n**Razón:** ${reason}` });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - UNLOCK')
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: 'Canal desbloqueado', value: `${channel}`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        // --- /SLOWMODE ---
        } else if (commandName === 'slowmode') {
            const seconds = options.getInteger('segundos');
            if (seconds < 0 || seconds > 21600) {
                return interaction.reply({ content: '❌ Los segundos deben estar entre 0 y 21600.', ephemeral: true });
            }

            await channel.setRateLimitPerUser(seconds, reason);

            const statusText = seconds === 0 
                ? `⏱️ **Modo lento desactivado** en ${channel} por ${staff}.` 
                : `⏱️ **Modo lento establecido a ${seconds} segundos** en ${channel} por ${staff}.\n**Razón:** ${reason}`;

            await interaction.reply({ content: statusText });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - SLOWMODE')
                    .setColor(0x3498DB)
                    .addFields(
                        { name: 'Canal', value: `${channel}`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Tiempo', value: `${seconds} segundos`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        // --- /DISABLECOMMANDS ---
        } else if (commandName === 'disablecommands') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { UseApplicationCommands: false });
            await channel.permissionOverwrites.edit(USER_ROLE_TO_LOCK, { UseApplicationCommands: false }).catch(() => {});

            await interaction.reply({ content: `🚫 **Comandos desactivados** en este canal por ${staff}.\n**Razón:** ${reason}` });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - DISABLECOMMANDS')
                    .setColor(0xE67E22)
                    .addFields(
                        { name: 'Canal', value: `${channel}`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        // --- /ENABLECOMMANDS ---
        } else if (commandName === 'enablecommands') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { UseApplicationCommands: null });
            await channel.permissionOverwrites.edit(USER_ROLE_TO_LOCK, { UseApplicationCommands: null }).catch(() => {});

            await interaction.reply({ content: `🟢 **Comandos reactivados** en este canal por ${staff}.\n**Razón:** ${reason}` });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - ENABLECOMMANDS')
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: 'Canal', value: `${channel}`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true },
                        { name: 'Razón', value: reason }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        // --- /CLEANCHAT ---
        } else if (commandName === 'cleanchat') {
            const amount = options.getInteger('cantidad');
            if (amount < 1 || amount > 100) return interaction.reply({ content: '❌ Cantidad entre 1 y 100.', ephemeral: true });

            const deleted = await channel.bulkDelete(amount, true).catch(() => null);
            if (!deleted) return interaction.reply({ content: '❌ No se pudieron borrar los mensajes.', ephemeral: true });

            await interaction.reply({ content: `🧹 **${deleted.size} mensajes borrados** por ${staff}.` });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - CLEANCHAT')
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'Canal', value: `${channel}`, inline: true },
                        { name: 'Mensajes borrados', value: `${deleted.size}`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }

        // --- /CLEARUSER ---
        } else if (commandName === 'clearuser') {
            const targetUser = options.getUser('usuario');
            const amount = options.getInteger('cantidad');
            if (amount < 1 || amount > 100) return interaction.reply({ content: '❌ Cantidad entre 1 y 100.', ephemeral: true });

            await interaction.deferReply();
            const messages = await channel.messages.fetch({ limit: amount });
            const userMessages = messages.filter(m => m.author.id === targetUser.id);

            if (userMessages.size === 0) return interaction.editReply({ content: `❌ Sin mensajes recientes de ${targetUser}.` });

            const deleted = await channel.bulkDelete(userMessages, true).catch(() => null);
            if (!deleted) return interaction.editReply({ content: '❌ No se pudieron borrar los mensajes.' });

            await interaction.editReply({ content: `🧹 Se borraron **${deleted.size} mensajes** de ${targetUser} por ${staff}.` });

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ REGISTRO DE MODERACIÓN - CLEARUSER')
                    .setColor(0x9B59B6)
                    .addFields(
                        { name: 'Usuario afectado', value: `${targetUser} (${targetUser.tag})`, inline: true },
                        { name: 'Canal', value: `${channel}`, inline: true },
                        { name: 'Mensajes borrados', value: `${deleted.size}`, inline: true },
                        { name: 'Staff responsable', value: `${staff} (${staff.tag})`, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }
        }

    } catch (error) {
        console.error(error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ Ocurrió un error al ejecutar este comando.', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ Ocurrió un error al ejecutar este comando.', ephemeral: true });
        }
    }
});

client.login(TOKEN);
