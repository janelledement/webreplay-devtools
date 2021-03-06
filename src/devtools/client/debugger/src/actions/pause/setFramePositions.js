/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow

import type { ActorId, ExecutionPoint } from "../../types";
import type { ThunkArgs } from "../types";

import { getSourceByActorId, getCurrentThread, getSelectedFrame } from "../../selectors";
import { zip } from "lodash";

const { ThreadFront } = require("protocol/thread");

export function setFramePositions() {
  return async ({ dispatch, getState, client }: ThunkArgs) => {
    const thread = getCurrentThread(getState());
    const frame = getSelectedFrame(getState(), thread);
    if (!frame) {
      return;
    }

    const positions = await client.fetchAncestorFramePositions(frame.asyncIndex, frame.protocolId);
    const { scriptId } = await ThreadFront.getPreferredLocation(positions[0].frame);
    const sourceId = getSourceByActorId(getState(), scriptId).id;

    const locations = await Promise.all(
      positions.map(async ({ frame }) => {
        const { line, column } = await ThreadFront.getPreferredLocation(frame);
        return { line, column, sourceId };
      })
    );

    const combinedPositions = zip(positions, locations).map(([{ point, time }, location]) => {
      return { point, time, location };
    });

    if (frame != getSelectedFrame(getState(), thread)) {
      return;
    }

    dispatch({
      type: "SET_FRAME_POSITIONS",
      positions: combinedPositions,
      unexecuted: [],
    });
  };
}
