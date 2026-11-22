<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4">
    <p
      class="flex min-w-0 items-center gap-2 pl-2 text-sm"
      :class="clips ? 'text-destructive' : 'text-muted-foreground'"
    >
      <TriangleAlert v-if="clips" class="size-4 shrink-0" />
      {{ peakText }}
    </p>
    <Button
      variant="outline"
      size="sm"
      class="ml-auto"
      :disabled="autoPreampApplied"
      @click="applyAutoPreamp"
    >
      <Gauge />
      {{ $t("settings.dsp.parametric_eq.auto_preamp") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Gauge, TriangleAlert } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { autoPreampDb, eqPeakGainDb } from "@/helpers/parametric_eq_headroom";
import type { ParametricEQFilter } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

// Only the editor's own preamp is changed, in place, like the other controls.
const peq = defineModel<ParametricEQFilter>({ required: true });

// Above 0 dB the EQ's boosts can clip; a rounding remainder is not a warning.
const CLIP_THRESHOLD_DB = 0.05;
const GAIN_DECIMALS = 1;

const peakGain = computed(() => eqPeakGainDb(peq.value));
const autoPreamp = computed(() => autoPreampDb(peq.value));
const clips = computed(() => peakGain.value > CLIP_THRESHOLD_DB);

const formatGain = (gain: number) =>
  `${gain > 0 ? "+" : ""}${gain.toFixed(GAIN_DECIMALS)}`;

const peakText = computed(() =>
  $t(
    clips.value
      ? "settings.dsp.parametric_eq.peak_level_clipping"
      : "settings.dsp.parametric_eq.peak_level",
    { gain: formatGain(peakGain.value) },
  ),
);

const autoPreampApplied = computed(
  () => (peq.value.preamp ?? 0) === autoPreamp.value,
);

const applyAutoPreamp = () => {
  peq.value.preamp = autoPreamp.value;
};
</script>
