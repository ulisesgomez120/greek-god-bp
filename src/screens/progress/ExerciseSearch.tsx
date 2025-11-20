import React from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ListRenderItemInfo,
} from "react-native";
import usePerformedPlannedExercises, { PlannedExerciseSearchResult } from "../../hooks/usePerformedPlannedExercises";
import { useNavigation } from "@react-navigation/native";
import useAuth from "@/hooks/useAuth";
import useTheme from "@/hooks/useTheme";

/**
 * Grouping strategy:
 * - Group results by planName (top-level section)
 * - Within each plan, group by sessionName
 * - Sort plans by most recent lastPerformed (desc)
 * - Sort sessions by most recent lastPerformed (desc)
 * - Sort exercises within a session by lastPerformed (desc)
 *
 * Null/undefined planName or sessionName are normalized to "No Plan" / "No Session"
 */

type SessionGroup = {
  sessionName: string;
  sessionLast?: string | null;
  items: PlannedExerciseSearchResult[];
};

type PlanSection = {
  title: string; // planName
  planLast?: string | null;
  data: SessionGroup[]; // SectionList expects `data` array
};

function groupResults(results: PlannedExerciseSearchResult[]): PlanSection[] {
  const planMap = new Map<
    string,
    { planName: string; sessions: Map<string, SessionGroup>; planLast?: string | null }
  >();

  for (const r of results) {
    const planKey = r.planName ?? "__NO_PLAN__";
    const sessionKey = r.sessionName ?? "__NO_SESSION__";

    if (!planMap.has(planKey)) {
      planMap.set(planKey, {
        planName: r.planName ?? "No Plan",
        sessions: new Map(),
        planLast: null,
      });
    }

    const plan = planMap.get(planKey)!;

    if (!plan.sessions.has(sessionKey)) {
      plan.sessions.set(sessionKey, {
        sessionName: r.sessionName ?? "No Session",
        items: [],
        sessionLast: null,
      });
    }

    const sess = plan.sessions.get(sessionKey)!;
    sess.items.push(r);

    const lp = r.lastPerformed ?? null;
    if (lp) {
      // update session last
      if (!sess.sessionLast || new Date(lp) > new Date(sess.sessionLast)) {
        sess.sessionLast = lp;
      }
      // update plan last
      if (!plan.planLast || new Date(lp) > new Date(plan.planLast!)) {
        plan.planLast = lp;
      }
    }
  }

  // Convert to array and sort
  const sections: PlanSection[] = Array.from(planMap.values()).map((p) => {
    const sessions = Array.from(p.sessions.values()).map((s) => {
      // sort items within session by lastPerformed desc
      const items = s.items.slice().sort((a, b) => {
        const ta = a.lastPerformed ? new Date(a.lastPerformed).getTime() : 0;
        const tb = b.lastPerformed ? new Date(b.lastPerformed).getTime() : 0;
        return tb - ta;
      });
      return { ...s, items };
    });

    // sort sessions by sessionLast desc
    sessions.sort((a, b) => {
      const ta = a.sessionLast ? new Date(a.sessionLast).getTime() : 0;
      const tb = b.sessionLast ? new Date(b.sessionLast).getTime() : 0;
      return tb - ta;
    });

    return {
      title: p.planName,
      planLast: p.planLast,
      data: sessions,
    };
  });

  // sort plans by planLast desc
  sections.sort((a, b) => {
    const ta = a.planLast ? new Date(a.planLast).getTime() : 0;
    const tb = b.planLast ? new Date(b.planLast).getTime() : 0;
    return tb - ta;
  });

  return sections;
}

export default function ExerciseSearchScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { searchQuery, setSearchQuery, results, loading, error, fetchMore, hasMore } = usePerformedPlannedExercises(
    "",
    {
      userId: user?.id,
      debounceMs: 300,
      pageSize: 20,
    }
  );

  const sections = React.useMemo(() => groupResults(results), [results]);

  const renderExercise = (item: PlannedExerciseSearchResult) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate(
          "ExerciseDetailProgress" as never,
          { exerciseId: item.exerciseId, plannedExerciseId: item.plannedExerciseId } as never
        )
      }
      style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontWeight: "600", color: colors.text }}>{item.exerciseName}</Text>
      <Text style={{ color: colors.subtext, marginTop: 4 }}>
        {`Sets ${item.targetSets} • Reps ${item.targetRepsMin} • last: ${
          item.lastPerformed ? new Date(item.lastPerformed).toLocaleDateString() : "N/A"
        }`}
      </Text>
    </TouchableOpacity>
  );

  const renderSession = ({ item }: ListRenderItemInfo<SessionGroup>) => {
    const session = item;
    return (
      <View style={{ paddingHorizontal: 8 }}>
        <View style={{ paddingVertical: 10 }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>{session.sessionName}</Text>
          {session.sessionLast ? (
            <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }}>
              {new Date(session.sessionLast).toLocaleDateString()}
            </Text>
          ) : null}
        </View>

        {/* Exercises for this session */}
        <View>
          {session.items.map((ex) => (
            <View key={ex.plannedExerciseId}>{renderExercise(ex)}</View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <TextInput
        placeholder='Search performed planned exercises'
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={{ padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 12 }}
        accessibilityLabel='Search performed planned exercises'
      />

      {loading && results.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.sessionName}-${index}`}
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: colors.surfaceElevated, paddingVertical: 8, paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>{(section as any).title}</Text>
              {(section as any).planLast ? (
                <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
                  Last: {new Date((section as any).planLast).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
          )}
          renderItem={renderSession}
          onEndReached={() => {
            if (hasMore) fetchMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={() => (
            <View style={{ padding: 24 }}>
              <Text style={{ textAlign: "center", color: colors.subtext }}>No performed planned exercises found.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
