import { default as crypto } from 'crypto';
import { default as sgMail } from '@sendgrid/mail';
import { Request, Response, NextFunction } from 'express';
import lookupCommunityIsVisibleToUser from '../util/lookupCommunityIsVisibleToUser';
import { SERVER_URL, SENDGRID_API_KEY } from '../config';

export const Errors = {
  NoEmailAndAddress: 'Can only invite either an address or email, not both',
  NoEmailOrAddress: 'Must invite an address or email',
  MustBeAdminOrMod: 'Must be an admin/mod to invite new members',
  AddressNotFound: 'Address not found',
  IsAlreadyMember: 'Already a member of this community',
  InvalidEmail: 'Invalid email',
  FailedToSendEmail: 'Could not send invite email',
};

sgMail.setApiKey(SENDGRID_API_KEY);
import { factory, formatFilename } from '../util/logging';
const log = factory.getLogger(formatFilename(__filename));

const createInvite = async (models, req: Request, res: Response, next: NextFunction) => {
  const [chain, community] = await lookupCommunityIsVisibleToUser(models, req.body, req.user, next);
  if (!req.user) return next(new Error('Not logged in'));

  if (!req.body.invitedAddress && !req.body.invitedEmail) {
    return next(new Error(Errors.NoEmailOrAddress));
  }

  if (req.body.invitedAddress && req.body.invitedEmail) {
    return next(new Error(Errors.NoEmailAndAddress));
  }

  const chainOrCommObj = chain
    ? { chain_id: chain.id }
    : { offchain_community_id: community.id };

  // check that invitesEnabled === true, or the user is an admin or mod
  if (!community.invitesEnabled) {
    const address = await models.Address.findOne({
      where: {
        address: req.body.address,
        user_id: req.user.id,
      },
    });

    if (!address) return next(new Error(Errors.AddressNotFound));
    const requesterIsAdminOrMod = await models.Role.findAll({
      where: {
        ...chainOrCommObj,
        address_id: address.id,
        permission: ['admin', 'moderator']
      },
    });
    if (requesterIsAdminOrMod.length === 0) return next(new Error(Errors.MustBeAdminOrMod));
  }

  const { invitedEmail } = req.body;
  if (req.body.invitedAddress) {
    const existingAddress = await models.Address.findOne({
      where: {
        address: req.body.invitedAddress,
      }
    });
    if (!existingAddress) return next(new Error(Errors.AddressNotFound));
    const existingRole = await models.Role.findOne({
      where: {
        ...chainOrCommObj,
        address_id: existingAddress.id,
      },
    });
    if (existingRole) return next(new Error(Errors.IsAlreadyMember));
    const role = await models.Role.create({
      ...chainOrCommObj,
      address_id: existingAddress.id,
      permission: 'member',
    });
    return res.json({ status: 'Success', result: role.toJSON() });
  }

  // validate the email
  const validEmailRegex = /\S+@\S+\.\S+/;
  if (!validEmailRegex.test(invitedEmail)) {
    return next(new Error(Errors.InvalidEmail));
  }

  const user = await models.User.findOne({
    where: {
      email: invitedEmail,
    },
  });
  const previousInvite = await models.InviteCode.findOne({
    where: {
      invited_email: invitedEmail,
      community_id: community.id,
    }
  });
  if (previousInvite && previousInvite.used === true) { await previousInvite.update({ used: false, }); }
  let invite = previousInvite;
  if (!previousInvite) {
    const inviteCode = crypto.randomBytes(24).toString('hex');
    invite = await models.InviteCode.create({
      id: inviteCode,
      community_id: community.id,
      community_name: community.name,
      creator_id: req.user.id,
      invited_email: invitedEmail,
      used: false,
    });
  }

  // create and email the link
  const joinOrLogIn = user ? 'Log in' : 'Sign up';
  const signupLink = SERVER_URL;
  const msg = {
    to: invitedEmail,
    from: 'Commonwealth <no-reply@commonwealth.im>',
    subject: `Invitation to ${invite.community_id}`,
    text: `You have been invited to the ${invite.community_name} community. ` +
      `${joinOrLogIn} to accept or see more information: ${signupLink}`,
    html: `You have been invited to the <strong>${invite.community_name}</strong> community. ` +
      `${joinOrLogIn} to accept or see more information: ${signupLink}`,
    mail_settings: {
      sandbox_mode: {
        enable: (process.env.NODE_ENV === 'development'),
      }
    },
  };

  try {
    const message = await sgMail.send(msg);
    return res.json({ status: 'Success', result: invite.toJSON() });
  } catch (e) {
    return res.status(500).json({ error: Errors.FailedToSendEmail, message: e.message });
  }
};

export default createInvite;
