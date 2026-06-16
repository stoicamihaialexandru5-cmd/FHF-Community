import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { setStaffProtection, isStaffProtected } from '../../services/staffActivity.js';

export default {
    data: new SlashCommandBuilder()
        .setName("staffprotect")
        .setDescription("Protects a staff member from the daily message warning system.")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("The staff member to protect/unprotect.")
                .setRequired(true)
        )
        .addBooleanOption((option) =>
            option
                .setName("status")
                .setDescription("True to protect, False to unprotect.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser("user");
            const status = interaction.options.getBoolean("status");

            if (!interaction.inGuild()) {
                return interaction.reply({
                    embeds: [errorEmbed('Error', 'This command can only be used in a server.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            const success = await setStaffProtection(interaction.guildId, targetUser.id, status);

            if (success) {
                const actionText = status ? "protejat" : "neprotejat (warn-urile vor fi reluate)";
                await interaction.reply({
                    embeds: [
                        successEmbed(
                            `Staff Protection Updated`,
                            `Utilizatorul ${targetUser} este acum **${actionText}** față de sistemul de warn zilnic.`
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });
                logger.info(`Staff protection for ${targetUser.tag} set to ${status} by ${interaction.user.tag}`);
            } else {
                await interaction.reply({
                    embeds: [errorEmbed('Database Error', 'Could not update staff protection status.')],
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'staffprotect',
                context: 'staff_protection_toggle'
            });
        }
    },
};
