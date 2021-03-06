/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow
import React, { PureComponent } from "react";
import { showMenu } from "devtools-contextmenu";
import { connect } from "../../utils/connect";
import actions from "../../actions";
import { features } from "../../utils/prefs";

import {
  getSelectedSource,
  getSelectedFrame,
  getFrameScope,
  getPauseReason,
  getThreadContext,
  getLastExpandedScopes,
} from "../../selectors";
import { getScopes, ScopeFront } from "../../utils/pause/scopes";
import { getScopeItemPath } from "../../utils/pause/scopes/utils";

const { objectInspector } = require("devtools-reps");

import type { ThreadContext, Why } from "../../types";
import type { NamedValue } from "../../utils/pause/scopes/types";

import "./Scopes.css";

const ObjectInspector = objectInspector.ObjectInspector.default;

type OwnProps = {||};
type Props = {
  cx: ThreadContext,
  selectedFrame: Object,
  frameScopes: Object,
  isLoading: boolean,
  why: ?Why,
  openLink: typeof actions.openLink,
  openElementInInspector: typeof actions.openElementInInspectorCommand,
  highlightDomElement: typeof actions.highlightDomElement,
  unHighlightDomElement: typeof actions.unHighlightDomElement,
  setExpandedScope: typeof actions.setExpandedScope,
  addWatchpoint: typeof actions.addWatchpoint,
  removeWatchpoint: typeof actions.removeWatchpoint,
  expandedScopes: string[],
};

type State = {
  scopes: ?(NamedValue[]),
};

type Node = {
  contents: ?{
    watchpoint: ?"get" | "set",
  },
  name: string,
  path: string,
};

class Scopes extends PureComponent<Props, State> {
  constructor(props: Props) {
    const { why, selectedFrame, frameScopes } = props;

    super(props);

    this.state = {
      scopes: getScopes(why, selectedFrame, frameScopes),
    };
  }

  componentWillReceiveProps(nextProps: Props) {
    const { cx, selectedFrame, frameScopes } = this.props;
    const isPausedChanged = cx.isPaused !== nextProps.cx.isPaused;
    const selectedFrameChanged = selectedFrame !== nextProps.selectedFrame;
    const frameScopesChanged = frameScopes !== nextProps.frameScopes;

    if (
      isPausedChanged ||
      selectedFrameChanged ||
      frameScopesChanged
    ) {
      this.setState({
        scopes: getScopes(
          nextProps.why,
          nextProps.selectedFrame,
          nextProps.frameScopes
        ),
      });
    }
  }

  onContextMenu = (event: any, item: any) => {
    const { addWatchpoint, removeWatchpoint } = this.props;

    if (!features.watchpoints || !item.parent || !item.contents.configurable) {
      return;
    }

    if (!item.contents || item.contents.watchpoint) {
      const removeWatchpointLabel = L10N.getStr("watchpoints.removeWatchpoint");

      const removeWatchpointItem = {
        id: "node-menu-remove-watchpoint",
        label: removeWatchpointLabel,
        disabled: false,
        click: () => removeWatchpoint(item),
      };

      const menuItems = [removeWatchpointItem];
      return showMenu(event, menuItems);
    }

    const addSetWatchpointLabel = L10N.getStr("watchpoints.setWatchpoint");
    const addGetWatchpointLabel = L10N.getStr("watchpoints.getWatchpoint");
    const watchpointsSubmenuLabel = L10N.getStr("watchpoints.submenu");

    const addSetWatchpointItem = {
      id: "node-menu-add-set-watchpoint",
      label: addSetWatchpointLabel,
      disabled: false,
      click: () => addWatchpoint(item, "set"),
    };

    const addGetWatchpointItem = {
      id: "node-menu-add-get-watchpoint",
      label: addGetWatchpointLabel,
      disabled: false,
      click: () => addWatchpoint(item, "get"),
    };

    const watchpointsSubmenuItem = {
      id: "node-menu-watchpoints",
      label: watchpointsSubmenuLabel,
      disabled: false,
      click: () => addWatchpoint(item, "set"),
      submenu: [addSetWatchpointItem, addGetWatchpointItem],
    };

    const menuItems = [watchpointsSubmenuItem];
    showMenu(event, menuItems);
  };

  renderWatchpointButton = (item: Node) => {
    return null;

    const { removeWatchpoint } = this.props;

    if (!item || !item.contents || !item.contents.watchpoint || typeof L10N === "undefined") {
      return null;
    }

    const watchpoint = item.contents.watchpoint;
    return (
      <button
        className={`remove-${watchpoint}-watchpoint`}
        title={L10N.getStr("watchpoints.removeWatchpointTooltip")}
        onClick={() => removeWatchpoint(item)}
      />
    );
  };

  renderScopesList() {
    const {
      cx,
      isLoading,
      openLink,
      openElementInInspector,
      highlightDomElement,
      unHighlightDomElement,
      setExpandedScope,
      expandedScopes,
    } = this.props;
    const { scopes } = this.state;

    function initiallyExpanded(item) {
      return expandedScopes.some(path => path == getScopeItemPath(item));
    }

    if (scopes && scopes.length > 0 && !isLoading) {
      const roots = scopes.map((s, i) => ({
        path: `scope${i}`,
        name: s.name,
        contents: s.contents,
      }));
      return (
        <div className="pane scopes-list">
          <ObjectInspector
            roots={roots}
            autoExpandAll={false}
            autoExpandDepth={1}
            disableWrap={true}
            dimTopLevelWindow={true}
            openLink={openLink}
            onDOMNodeClick={grip => openElementInInspector(grip)}
            onInspectIconClick={grip => openElementInInspector(grip)}
            onDOMNodeMouseOver={grip => highlightDomElement(grip)}
            onDOMNodeMouseOut={grip => unHighlightDomElement(grip)}
            onContextMenu={this.onContextMenu}
            setExpanded={(path, expand) => setExpandedScope(cx, path, expand)}
            initiallyExpanded={initiallyExpanded}
            renderItemActions={this.renderWatchpointButton}
          />
        </div>
      );
    }

    let stateText = L10N.getStr("scopes.notPaused");
    if (cx.isPaused) {
      if (isLoading) {
        stateText = L10N.getStr("loadingText");
      } else {
        stateText = L10N.getStr("scopes.notAvailable");
      }
    }

    return (
      <div className="pane scopes-list">
        <div className="pane-info">{stateText}</div>
      </div>
    );
  }

  render() {
    return <div className="scopes-content">{this.renderScopesList()}</div>;
  }
}

const mapStateToProps = state => {
  const cx = getThreadContext(state);
  const selectedFrame = getSelectedFrame(state, cx.thread);
  const selectedSource = getSelectedSource(state);

  const { scope, pending } = getFrameScope(
    state,
    cx.thread,
    selectedFrame && selectedFrame.id
  ) || {
    scope: null,
    pending: false,
  };

  return {
    cx,
    selectedFrame,
    isLoading: pending,
    why: getPauseReason(state, cx.thread),
    frameScopes: scope,
    expandedScopes: getLastExpandedScopes(state, cx.thread),
  };
};

export default connect<Props, OwnProps, _, _, _, _>(mapStateToProps, {
  openLink: actions.openLink,
  openElementInInspector: actions.openElementInInspectorCommand,
  highlightDomElement: actions.highlightDomElement,
  unHighlightDomElement: actions.unHighlightDomElement,
  setExpandedScope: actions.setExpandedScope,
  addWatchpoint: actions.addWatchpoint,
  removeWatchpoint: actions.removeWatchpoint,
})(Scopes);
