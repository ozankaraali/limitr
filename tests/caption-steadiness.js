// How steady a live caption line is. Each line's versions, as shown one after another: how many
// shown words a later version changed or took back, or put a word in before, per 100 words of the
// last versions. Words are matched in order (the longest common run), so a word put in doesn't
// count the ones after it; the last word growing ("her", then "herkese") is no change, nor are
// words added at the end.

const words = text => text.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

function changedPer100(lines) {
  let changed = 0;
  let total = 0;
  for (const versions of lines) {
    for (let i = 1; i < versions.length; i++) {
      const before = words(versions[i - 1]);
      const after = words(versions[i]);
      const same = (k, j) => before[k] === after[j] || (k === before.length - 1 && after[j].startsWith(before[k]));
      const run = [new Array(after.length + 1).fill(0)];
      for (let k = 0; k < before.length; k++) {
        const row = [0];
        for (let j = 0; j < after.length; j++) row[j + 1] = same(k, j) ? run[k][j] + 1 : Math.max(run[k][j + 1], row[j]);
        run.push(row);
      }
      // Walk the match back into pairs; between two matched words, a word changed, taken back or
      // put in counts once (a changed word is one of each); after the last, only those taken back
      const pairs = [];
      for (let k = before.length, j = after.length; k > 0 && j > 0;) {
        if (same(k - 1, j - 1) && run[k][j] === run[k - 1][j - 1] + 1) pairs.unshift([--k, --j]);
        else if (run[k - 1][j] >= run[k][j - 1]) k--;
        else j--;
      }
      let k = 0;
      let j = 0;
      for (const [pk, pj] of pairs) {
        changed += Math.max(pk - k, pj - j);
        k = pk + 1;
        j = pj + 1;
      }
      changed += before.length - k;
    }
    if (versions.length) total += words(versions[versions.length - 1]).length;
  }
  return total ? 100 * changed / total : NaN;
}

module.exports = { changedPer100 };
