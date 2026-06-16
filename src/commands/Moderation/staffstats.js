import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { getFromDb } from '../../utils/database.js';
import { getStaffActivityKey, getStaffProtectionKey } from '../../services/staffActivity.js';

const STAFF_ROLE_ID = '1511487812615012543';
const DAILY_MESSAGE_QUOTA = 50;

export default {
    data: new SlashCommandBuilder()
        .setName("staffstats")
        .setDescription("Verifică activitatea zilnică a tuturor membrilor STAFF.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            if (!interaction.inGuild()) {
                return interaction.reply({
                    embeds: [errorEmbed('Error', 'Această comandă poate fi folosită doar pe server.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guild = interaction.guild;
            await guild.members.fetch();

            const staffMembers = guild.members.cache.filter(m => m.roles.cache.has(STAFF_ROLE_ID));
            const protections = await getFromDb(getStaffProtectionKey(guild.id), {});

            if (staffMembers.size === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed('Eroare', 'Nu există niciun membru cu rolul STAFF pe acest server.')]
                });
            }

            let statsText = '';

            for (const [userId, member] of staffMembers) {
                if (protections[userId]) {
                    statsText += `🛡️ ${member.toString()} - **Protejat** (Nu primește warn)\n`;
                    continue;
                }

                const key = getStaffActivityKey(guild.id, userId);
                const data = await getFromDb(key, { messages: 0, voiceTimeMs: 0 });
                
                const statusIcon = data.messages >= DAILY_MESSAGE_QUOTA ? '✅' : '⚠️';
                statsText += `${statusIcon} ${member.toString()} - **${data.messages}/${DAILY_MESSAGE_QUOTA}** mesaje trimise azi.\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('📊 Statistici Activitate STAFF (Azi)')
                .setDescription(statsText)
                .setColor('#2b2d31')
                .setFooter({ text: 'Statusul se va reseta la miezul nopții.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'staffstats',
                context: 'staff_stats_check'
            });
        }
    },
};
