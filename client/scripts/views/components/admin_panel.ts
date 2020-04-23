import m from 'mithril';
import $ from 'jquery';
import { OffchainThread, OffchainTag, CommunityInfo, RolePermission } from 'models';
import { Button, Classes, Dialog, Icon, Icons, Tag, TagInput, ListItem, Table, Input, List, TextArea } from 'construct-ui';
import app from 'state';
import { sortAdminsAndModsFirst } from 'views/pages/discussions/roles';
import User from './widgets/user';

const RoleRow: m.Component<{ roledata? }> = {
  view: (vnode) => {
    return (vnode.attrs.roledata?.length > 0) ?
      m('RoleData', [
          vnode.attrs.roledata?.map((role) => {
            return m('.role-item', { style: 'display: inline-block; padding-right: 6px;' }, [
              m(User, {
                user: [role.Address.address, role.Address.chain],
                linkify: true,
                tooltip: true,
              }),
              m(Icon, {
                name: Icons.X,
                size: 'xs',
                style: 'padding-left: 2px;',
                onclick: () => { console.dir('demote admin to member'); }, // TODO: Remove from local roles and db
              }),
            ]);
          }),
      ])
      : m('div');
  }
};

interface ICommunityMetadataState {
    name: string;
    description: string;
    url: string;
    creator;
    admins;
    mods;
    loadingFinished: boolean;
    loadingStarted: boolean;
    roleData;
}

const CommunityMetadata: m.Component<{community: CommunityInfo, onChangeHandler: Function}, ICommunityMetadataState> = {
  oninit: (vnode) => {
    vnode.state.name = vnode.attrs.community.name;
    vnode.state.description = vnode.attrs.community.description;
    vnode.state.url = vnode.attrs.community.id;
  },
  view: (vnode) => {
    const chainOrCommObj = (app.chain) ? { chain: app.activeChainId() } : { community: app.activeCommunityId() };
    const loadRoles = async () => {
      try {
        const bulkMembers = await $.get(`${app.serverUrl()}/bulkMembers`, chainOrCommObj);
        if (bulkMembers.status !== 'Success') throw new Error('Could not fetch members');
        vnode.state.roleData = bulkMembers.result;
        vnode.state.loadingFinished = true;
        m.redraw();
      } catch (err) {
        vnode.state.roleData = [];
        vnode.state.loadingFinished = true;
        m.redraw();
        console.error(err);
      }
    };

    if (!vnode.state.loadingStarted) {
      vnode.state.loadingStarted = true;
      loadRoles();
    }

    const admins = [];
    const mods = [];
    if (vnode.state.roleData?.length > 0) {
      vnode.state.roleData.sort(sortAdminsAndModsFirst).map((role) => {
        if (role.permission === RolePermission.admin) admins.push(role);
        else if (role.permission === RolePermission.moderator) mods.push(role);
      });
    }

    return m('div', [m(Table, {
      bordered: false,
      interactive: false,
      striped: false,
      class: '.community.metadata',
      style: 'table-layout: fixed;'
    }, [
      m('tr', [
        m('td', { style: 'width: 100px' }, 'Name'),
        m('td', [
          m(Input, {
            defaultValue: vnode.state.name,
            fluid: true,
            value: vnode.state.name,
            onchange: (e) => { vnode.state.name = (e.target as any).value; },
          }),
        ]),
      ]),
      m('tr', [
        m('td', 'Description'),
        m('td', [
          m(Input, {
            defaultValue: vnode.state.description,
            fluid: true,
            value: vnode.state.description,
            onchange: (e) => { vnode.state.description = (e.target as any).value; },
          }),
        ]),
      ]),
      m('tr', [
        m('td', 'URL'),
        m('td', [
          m(Input, {
            defaultValue: `commonwealth.im/${vnode.state.url}`,
            fluid: true,
            disabled: true,
            value: `commonwealth.im/${vnode.state.url}`,
          }),
        ]),
      ]),
      m('tr', [
        m('td', 'Admins'),
        m('td', [ m(RoleRow, { roledata: admins }), ])
      ]),
      mods.length > 0 &&
        m('tr', [
          m('td', 'Moderators'),
          m('td', [ m(RoleRow, { roledata: mods }), ])
        ]),
    ]),
    m(Button, {
      label: 'submit',
      onclick: () => {
        vnode.attrs.community.updateCommunityData(vnode.state.name, vnode.state.description);
        vnode.attrs.onChangeHandler(false);
      },
    }),
    ]);
  },
};

const ChainMetadata: m.Component = {
  view: (vnode) => {
    return m(Table, {
      bordered: false,
      interactive: false,
      striped: true,
      class: '.chain.metadata'
    });
  },
};

const Panel: m.Component<{onChangeHandler: Function}> = {
  view: (vnode) => {
    const chainOrCommObj = (app.chain) ? { chain: app.activeChainId() } : { community: app.activeCommunityId() };
    const isCommunity = !!app.activeCommunityId();
    return m('.Panel', [
      m('.panel-left', { style: 'width: 70%;' }, [
        (isCommunity)
          ? m(CommunityMetadata, { community: app.community.meta, onChangeHandler: vnode.attrs.onChangeHandler })
          : m(ChainMetadata),
      ]),
      m('.panel-right', []),
    ]);
  }
};

const AdminPanel: m.Component<{}, {isOpen: boolean}> = {
  oninit: (vnode) => {
    vnode.state.isOpen = false;
  },
  oncreate: (vnode) => {
  },
  view: (vnode) => {
    return m('AdminPanel', [
      m(ListItem, {
        href: '#',
        onclick: (e) => { e.preventDefault(); vnode.state.isOpen = true; },
        label: 'Manage Community',
      }),
      m(Dialog, {
        autofocus: true,
        basic: false,
        closeOnEscapeKey: true,
        closeOnOutsideClick: true,
        content: m(Panel, {
          onChangeHandler: (v) => { vnode.state.isOpen = v; },
        }),
        hasBackdrop: true,
        isOpen: vnode.state.isOpen,
        inline: false,
        onClose: () => { vnode.state.isOpen = false; },
        title:'Manage Community',
        transitionDuration: 200,
        footer: null,
      }),
    ]);
  },
};

export default AdminPanel;
