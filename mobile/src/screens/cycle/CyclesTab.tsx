/**
 * Tab "Vụ trồng" of a plot — the cultivation history.
 *
 *   1. Gợi ý cho vụ tới — the crops this plot did best with, for a season
 *   2. Vụ đang trồng — with what it has cost so far (giống + phân + công)
 *   3. Lịch sử trồng trọt — every finished season: yield, productivity, cost/kg, photos
 *   4. So sánh năng suất — each crop's seasons side by side
 *
 * Kept apart from the task history on purpose ("Chăm sóc" tab): what was
 * grown and harvested is a different question from which jobs were done.
 */

import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {useCurrentUser} from '../../auth/AuthContext';
import {Badge} from '../../components/Badge';
import {GhostButton, SecondaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {SelectChip} from '../../components/form';
import {InfoTooltip} from '../../components/InfoTooltip';
import {MediaStrip} from '../../components/MediaStrip';
import type CropCycle from '../../db/models/CropCycle';
import type Expense from '../../db/models/Expense';
import type Plot from '../../db/models/Plot';
import type WarehouseOut from '../../db/models/WarehouseOut';
import {observeCycles} from '../../db/repositories/cropCycleRepository';
import {observePlotExpenses} from '../../db/repositories/financeRepository';
import {observePlotIssues} from '../../db/repositories/warehouseRepository';
import {useObservable} from '../../db/useObservable';
import type {CropSuggestion, PlotCosts, Season} from '../../domain/cultivation';
import {
  costPerKg,
  cycleSeason,
  nextSeason,
  plotCosts,
  productivity,
  recommendCrops,
  seasonLabel,
  SEASONS,
  vnNumber,
  yearOf,
} from '../../domain/cultivation';
import {parseMediaRefs} from '../../domain/media';
import {startOfDay} from '../../domain/warehouse';
import {colors, radius, space, text} from '../../theme';
import {formatDate, formatVnd} from '../../utils/format';
import {cropNameOf, STAGE_LABELS} from '../../utils/staticData';
import type {CycleSheetMode} from './CropCycleFormSheet';
import {CropCycleFormSheet} from './CropCycleFormSheet';

const DAY = 86_400_000;

export function CyclesTab({plot}: {plot: Plot}) {
  const user = useCurrentUser();
  const cycles = useObservable<CropCycle[]>(() => observeCycles(plot.id), [plot.id], []);
  const expenses = useObservable<Expense[]>(() => observePlotExpenses(user.id, plot.id), [user.id, plot.id], []);
  const issues = useObservable<WarehouseOut[]>(() => observePlotIssues(user.id, plot.id), [user.id, plot.id], []);
  const [season, setSeason] = useState<Season>(() => nextSeason());
  const [sheet, setSheet] = useState<{mode: CycleSheetMode; cycle?: CropCycle} | null>(null);

  const active = cycles.find(c => !c.endedAt);
  const finished = cycles.filter(c => c.endedAt);
  const suggestions = useMemo(() => recommendCrops(cycles, season, cropNameOf), [cycles, season]);
  // Whole days: an expense entered at 07:00 on sowing day belongs to the season.
  const costsFor = (from: number, to: number | null) =>
    plotCosts(expenses, issues, plot.id, startOfDay(from), to == null ? null : startOfDay(to) + DAY - 1);

  return (
    <>
      <SuggestionCard season={season} onSeason={setSeason} suggestions={suggestions} />

      <View style={styles.actions}>
        {!active ? (
          <SecondaryButton
            small
            label="+ Bắt đầu vụ mới"
            onPress={() => setSheet({mode: 'create'})}
            style={styles.flex}
            testID="cycle-create"
          />
        ) : null}
        <SecondaryButton
          small
          label="+ Ghi vụ đã qua"
          onPress={() => setSheet({mode: 'past'})}
          style={styles.flex}
          testID="cycle-past"
        />
      </View>

      {active ? (
        <>
          <Text style={[text('eyebrow', colors.text.muted), styles.section]}>Vụ đang trồng</Text>
          <Card style={styles.card} testID="cycle-active">
            <CycleHeader cycle={active} />
            <Text style={[text('bodySm', colors.text.muted), styles.line]}>
              Xuống giống {formatDate(active.startedAt)} · đang canh tác
            </Text>
            <CostLine costs={costsFor(active.startedAt, null)} label="Chi phí từ lúc xuống giống" />
            <View style={styles.cardActions}>
              <SecondaryButton small label="Kết thúc vụ" onPress={() => setSheet({mode: 'end', cycle: active})} />
              <GhostButton small label="Sửa" onPress={() => setSheet({mode: 'edit', cycle: active})} />
            </View>
          </Card>
        </>
      ) : null}

      <Text style={[text('eyebrow', colors.text.muted), styles.section]}>Lịch sử trồng trọt</Text>
      {finished.length === 0 ? (
        <EmptyState
          title="Chưa có vụ nào đã xong"
          body="Ghi lại các vụ trước — cây gì, thu bao nhiêu kg — để ứng dụng tính năng suất và gợi ý cây cho vụ sau."
          action={{label: 'Ghi vụ đã qua', onPress: () => setSheet({mode: 'past'})}}
        />
      ) : (
        finished.map(cycle => (
          <FinishedCycleCard
            key={cycle.id}
            cycle={cycle}
            costs={costsFor(cycle.startedAt, cycle.endedAt)}
            onEdit={() => setSheet({mode: 'edit', cycle})}
          />
        ))
      )}

      <ProductivityChart cycles={finished} />

      <CropCycleFormSheet
        visible={sheet != null}
        onClose={() => setSheet(null)}
        plot={plot}
        cycle={sheet?.cycle}
        mode={sheet?.mode ?? 'create'}
        history={cycles}
      />
    </>
  );
}

/* ------------------------------ suggestion card ----------------------------- */

function SuggestionCard({
  season,
  onSeason,
  suggestions,
}: {
  season: Season;
  onSeason: (s: Season) => void;
  suggestions: readonly CropSuggestion[];
}) {
  const [top, ...rest] = suggestions;
  return (
    <Card style={styles.card} testID="suggestion-card">
      <View style={styles.row}>
        <Text style={[text('cardTitle'), styles.flex]}>Gợi ý cây cho vụ tới</Text>
        <InfoTooltip
          title="Gợi ý dựa vào đâu?"
          body="Chỉ dựa trên các vụ đã ghi sản lượng của chính lô này: cây nào đạt năng suất (kg trên 1.000 m²) trung bình cao nhất, ưu tiên các vụ cùng mùa. Ứng dụng không gợi ý cây lô chưa từng trồng."
        />
      </View>
      <View style={styles.seasonRow}>
        {SEASONS.map(s => (
          <SelectChip key={s.code} label={s.label.replace('Vụ ', '')} selected={s.code === season} onPress={() => onSeason(s.code)} />
        ))}
      </View>
      {top ? (
        <>
          <View style={styles.topPick} testID="suggestion-top">
            <Text style={text('caption', colors.primary.default)}>GỢI Ý</Text>
            <Text style={text('subheading')}>Trồng {top.cropName}</Text>
            <Text style={[text('bodySm', colors.text.secondary), styles.line]}>{top.reason}</Text>
          </View>
          {rest.slice(0, 2).map(s => (
            <View key={s.cropType} style={styles.otherPick}>
              <Text style={[text('bodyStrong'), styles.flex]}>{s.cropName}</Text>
              <Text style={text('bodySm', colors.text.secondary)}>
                TB {vnNumber(s.avgProductivity)} kg/1.000 m² · {s.cycles} vụ
              </Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={[text('bodySm', colors.text.muted), styles.line]}>
          Chưa đủ dữ liệu: cần ít nhất một vụ đã kết thúc có ghi sản lượng.
        </Text>
      )}
    </Card>
  );
}

/* --------------------------------- a cycle -------------------------------- */

function CycleHeader({cycle}: {cycle: CropCycle}) {
  const season = cycleSeason(cycle);
  return (
    <>
      <View style={styles.row}>
        <Text style={[text('cardTitle'), styles.flex]} numberOfLines={2}>
          {cycle.name}
        </Text>
        <Badge label={seasonLabel(season, yearOf(cycle.startedAt))} tone={cycle.endedAt ? 'gray' : 'green'} />
      </View>
      <Text style={[text('bodySm', colors.text.secondary), styles.line]}>
        {cropNameOf(cycle.cropType, cycle.cropName)}
        {cycle.varietyName ? ` · giống ${cycle.varietyName}` : ''}
        {!cycle.endedAt ? ` · ${STAGE_LABELS[cycle.stage]}` : ''}
      </Text>
    </>
  );
}

function FinishedCycleCard({cycle, costs, onEdit}: {cycle: CropCycle; costs: PlotCosts; onEdit: () => void}) {
  const value = productivity(cycle.yieldKg, cycle.areaM2);
  const perKg = costPerKg(costs.total, cycle.yieldKg);
  const media = useMemo(() => parseMediaRefs(cycle.mediaJson), [cycle.mediaJson]);
  return (
    <Card style={styles.card} testID={`cycle-${cycle.id}`}>
      <CycleHeader cycle={cycle} />
      <Text style={[text('bodySm', colors.text.muted), styles.line]}>
        {formatDate(cycle.startedAt)} → {formatDate(cycle.endedAt)}
      </Text>
      <View style={styles.stats}>
        <Stat label="Sản lượng" value={cycle.yieldKg != null ? `${vnNumber(cycle.yieldKg)} kg` : 'Chưa ghi'} />
        <Stat label="Năng suất" value={value != null ? `${vnNumber(value)}` : '—'} unit={value != null ? 'kg/1.000 m²' : undefined} />
        {perKg != null ? <Stat label="Giá thành" value={formatVnd(perKg)} unit="mỗi kg" /> : null}
      </View>
      {costs.total > 0 ? <CostLine costs={costs} label="Chi phí vụ này" /> : null}
      <MediaStrip refs={media} style={styles.line} />
      <GhostButton small label="Sửa" onPress={onEdit} style={styles.editLink} />
    </Card>
  );
}

function Stat({label, value, unit}: {label: string; value: string; unit?: string}) {
  return (
    <View style={styles.stat}>
      <Text style={text('caption', colors.text.muted)}>{label}</Text>
      <Text style={text('bodyStrong')}>{value}</Text>
      {unit ? <Text style={text('caption', colors.text.muted)}>{unit}</Text> : null}
    </View>
  );
}

/** "Giống 250.000₫ · Phân 236.000₫ · Công 300.000₫ = 786.000₫" — zeros left out. */
function CostLine({costs, label}: {costs: PlotCosts; label: string}) {
  const parts = [
    costs.seed ? `Giống ${formatVnd(costs.seed)}` : null,
    costs.fertilizer ? `Phân ${formatVnd(costs.fertilizer)}` : null,
    costs.labor ? `Công ${formatVnd(costs.labor)}` : null,
    costs.other ? `Khác ${formatVnd(costs.other)}` : null,
  ].filter(Boolean);
  return (
    <View style={styles.costBox}>
      <View style={styles.row}>
        <Text style={[text('bodySm', colors.text.secondary), styles.flex]}>{label}</Text>
        <Text style={text('bodyStrong')}>{formatVnd(costs.total)}</Text>
      </View>
      {parts.length ? <Text style={text('caption', colors.text.muted)}>{parts.join(' · ')}</Text> : null}
    </View>
  );
}

/* ---------------------------- productivity chart --------------------------- */

/**
 * Each crop's seasons as horizontal bars on one shared scale, labelled with
 * the season and the figure. One measure, one hue (the brand green), every
 * bar labelled — so no legend, and no colour carries meaning on its own.
 */
function ProductivityChart({cycles}: {cycles: readonly CropCycle[]}) {
  const groups = useMemo(() => {
    const byCrop = new Map<string, {name: string; points: {id: string; label: string; value: number}[]}>();
    for (const c of [...cycles].sort((a, b) => a.startedAt - b.startedAt)) {
      const value = productivity(c.yieldKg, c.areaM2);
      if (value == null) continue;
      const entry = byCrop.get(c.cropType) ?? {name: cropNameOf(c.cropType, c.cropName), points: []};
      entry.points.push({id: c.id, label: seasonLabel(cycleSeason(c), yearOf(c.startedAt)), value});
      byCrop.set(c.cropType, entry);
    }
    return [...byCrop.values()];
  }, [cycles]);

  const max = Math.max(0, ...groups.flatMap(g => g.points.map(p => p.value)));
  if (groups.length === 0 || max === 0) return null;

  return (
    <>
      <Text style={[text('eyebrow', colors.text.muted), styles.section]}>So sánh năng suất (kg/1.000 m²)</Text>
      <Card style={styles.card} testID="productivity-chart">
        {groups.map((g, gi) => (
          <View key={g.name} style={gi > 0 ? styles.chartGroup : undefined}>
            <Text style={text('bodyStrong')}>{g.name}</Text>
            {g.points.map(p => (
              <View
                key={p.id}
                style={styles.barRow}
                accessible
                accessibilityLabel={`${g.name}, ${p.label}: ${vnNumber(p.value)} ki-lô-gam trên 1.000 mét vuông`}>
                <Text style={[text('caption', colors.text.secondary), styles.barLabel]} numberOfLines={1}>
                  {p.label.replace('Vụ ', '')}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, {width: `${Math.max(2, (p.value / max) * 100)}%`}]} />
                </View>
                <Text style={[text('caption'), styles.barValue]}>{vnNumber(p.value)}</Text>
              </View>
            ))}
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: space.md,
  },
  section: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    marginTop: space.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.sm,
  },
  seasonRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  topPick: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.selected,
  },
  otherPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    paddingHorizontal: space.md,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  stats: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.md,
  },
  stat: {
    flex: 1,
  },
  costBox: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.subtle,
    gap: 2,
  },
  editLink: {
    alignSelf: 'flex-start',
    marginLeft: -space.md,
    marginTop: space.xs,
  },
  chartGroup: {
    marginTop: space.lg,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    minHeight: 24,
  },
  barLabel: {
    width: 64,
  },
  barTrack: {
    flex: 1,
    height: 12,
  },
  bar: {
    height: 12,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.primary.default,
  },
  barValue: {
    width: 52,
    textAlign: 'right',
  },
});
