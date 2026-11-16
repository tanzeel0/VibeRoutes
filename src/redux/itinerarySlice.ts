"use client";

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { readEventStream } from "@/lib/readEventStream";
import type { DayItinerary, ItineraryPayload, GenerateRequest, Interest, PurposeTag, VibeTag } from "@/types/itinerary";

interface ItineraryState {
  status: "idle" | "streaming" | "done" | "error";
  days: DayItinerary[];
  meta: ItineraryPayload | null;
  error: string | null;
  /** "Model X didn't respond — switching to Y" while generating */
  modelNotice: string | null;
  activeDay: number | null;
  input: GenerateRequest;
  userPrompt: string;
}

const initialState: ItineraryState = {
  status: "idle",
  days: [],
  meta: null,
  error: null,
  modelNotice: null,
  activeDay: null,
  userPrompt: "",
  input: {
    origin: "",
    destination: "",
    vibe: { primary: "street-food" as VibeTag },
    interests: ["street food" as Interest],
    purpose: ["leisure" as PurposeTag],
    duration: { days: 4 },
  },
};

export const generateItinerary = createAsyncThunk(
  "itinerary/generate",
  async (input: GenerateRequest, { dispatch }) => {
    dispatch(itinerarySlice.actions.clearForNew());
    dispatch(itinerarySlice.actions.setStatus("streaming"));
    await streamGenerate(input, dispatch);
  }
);

export const modifyItinerary = createAsyncThunk(
  "itinerary/modify",
  async (
    args: {
      instruction: string;
      current: ItineraryPayload;
      days: DayItinerary[];
    },
    { dispatch }
  ) => {
    const { instruction, current, days } = args;
    dispatch(itinerarySlice.actions.beginModify());
    dispatch(itinerarySlice.actions.setStatus("streaming"));

    const input: GenerateRequest & {
      modification: string;
      existing_itinerary: {
        title: string;
        route_summary: string;
        duration: { days: number; nights: number };
        itinerary: DayItinerary[];
      };
    } = {
      origin: current.origin,
      destination: current.destination,
      vibe: current.vibe,
      interests: (current.interests?.length
        ? current.interests
        : ["street food"]) as Interest[],
      purpose: (current.purpose?.length
        ? current.purpose
        : ["leisure"]) as PurposeTag[],
      duration: { days: current.duration.days },
      extra_context: instruction,
      modification: instruction,
      existing_itinerary: {
        title: current.title,
        route_summary: current.route_summary,
        duration: current.duration,
        itinerary: days.length ? days : current.itinerary,
      },
    };

    await streamGenerate(input, dispatch);
  }
);

async function streamGenerate(
  input: GenerateRequest | (GenerateRequest & Record<string, unknown>),
  dispatch: (action: unknown) => void
) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok || !res.body) {
    throw new Error("Failed to start generation");
  }

  for await (const event of readEventStream(res.body)) {
    if (event.type === "day") {
      dispatch(itinerarySlice.actions.addDay(event.data as DayItinerary));
    } else if (event.type === "meta") {
      dispatch(itinerarySlice.actions.setMeta(event.data as ItineraryPayload));
    } else if (event.type === "notice") {
      const message = (event.data as { message?: string })?.message;
      if (message) dispatch(itinerarySlice.actions.setModelNotice(message));
    } else if (event.type === "error") {
      dispatch(
        itinerarySlice.actions.setError(
          "Could not build your itinerary right now. Please try again."
        )
      );
      return;
    }
  }

  dispatch(itinerarySlice.actions.setStatus("done"));
}

const itinerarySlice = createSlice({
  name: "itinerary",
  initialState,
  reducers: {
    reset(state) {
      state.status = "idle";
      state.days = [];
      state.meta = null;
      state.error = null;
      state.activeDay = null;
      state.userPrompt = "";
    },
    clearForNew(state) {
      state.modelNotice = null;
      state.days = [];
      state.meta = null;
      state.error = null;
      state.activeDay = null;
    },
    beginModify(state) {
      state.modelNotice = null;
      // Keep meta visible while regenerating; clear days for the stream
      state.days = [];
      state.error = null;
      state.activeDay = null;
    },
    setStatus(state, action: PayloadAction<ItineraryState["status"]>) {
      state.status = action.payload;
      if (action.payload !== "streaming") state.modelNotice = null;
    },
    setModelNotice(state, action: PayloadAction<string | null>) {
      state.modelNotice = action.payload;
    },
    addDay(state, action: PayloadAction<DayItinerary>) {
      state.days.push(action.payload);
    },
    setMeta(state, action: PayloadAction<ItineraryPayload>) {
      state.meta = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.status = "error";
      state.modelNotice = null;
      state.error = action.payload;
    },
    setActiveDay(state, action: PayloadAction<number | null>) {
      state.activeDay = action.payload;
    },
    updateInput(state, action: PayloadAction<Partial<GenerateRequest>>) {
      state.input = { ...state.input, ...action.payload };
    },
    setUserPrompt(state, action: PayloadAction<string>) {
      state.userPrompt = action.payload;
    },
    loadSavedTrip(
      state,
      action: PayloadAction<{
        payload: ItineraryPayload;
        days: DayItinerary[];
        userPrompt?: string;
      }>
    ) {
      state.status = "done";
      state.meta = action.payload.payload;
      state.days = action.payload.days;
      state.error = null;
      state.activeDay = null;
      state.userPrompt =
        action.payload.userPrompt ||
        `${action.payload.payload.duration.days}-day trip from ${action.payload.payload.origin} to ${action.payload.payload.destination}`;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateItinerary.rejected, (state) => {
        state.status = "error";
        state.error =
          "Could not build your itinerary right now. Please try again.";
      })
      .addCase(modifyItinerary.rejected, (state) => {
        state.status = "error";
        state.error =
          "Could not update your trip right now. Please try again.";
      });
  },
});

export const {
  reset,
  clearForNew,
  beginModify,
  setStatus,
  addDay,
  setMeta,
  setError,
  setActiveDay,
  updateInput,
  setUserPrompt,
  loadSavedTrip,
} = itinerarySlice.actions;

export default itinerarySlice.reducer;
