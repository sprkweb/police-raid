"""Regenerate reference.json with Python 3; not needed by the Vitest suite.

Only the Python-2 tuple/int comparison is patched in memory. The archived
source stays byte-for-byte unchanged. RNG is fixed for reproducible decisions.
"""

import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace


class Player:
    def __init__(self, index):
        self.index = index

    def __eq__(self, other):
        return self.index == other.index

    def __hash__(self):
        return hash(self.index)


class Bot(Player):
    def others(self):
        return [p for p in self.game.players if p != self]


player_module = ModuleType("player")
player_module.Bot = Bot
sys.modules["player"] = player_module
root = Path(__file__).resolve().parent
source = (root.parent / "reference/pands.py").read_text()
source = source.replace("if result[0] > 0:", "if True:")
namespace = {}
exec(compile(source, "pands.py", "exec"), namespace)
namespace["random"] = SimpleNamespace(
    uniform=lambda a, b: a,
    sample=lambda players, count: players[:count],
)
bot = namespace["PandSBot"](0)
players = [Player(i) for i in range(5)]
bot.spy = False
bot.log = SimpleNamespace(info=lambda message: None)
bot.game = SimpleNamespace(
    players=players, turn=1, tries=1, wins=0, losses=0,
    leader=players[0], team=[players[0], players[1]],
)
bot.onGameRevealed(players, [])


def snapshot(name):
    return {
        "name": name,
        "friends": [[p.estimate() for p in row] for row in bot.friends],
        "suspects": [p.estimate() for p in bot.suspects],
        "supportSuspects": [p.estimate() for p in bot.supportSuspects],
        "suspeciousActions": [p.estimate() for p in bot.suspeciousActions],
        "possibleGoodActions": [p.estimate() for p in bot.possibleGoodActions],
        "badGroup": {"players": list(bot._getBadPair()[0]), "score": bot._getBadPair()[1]},
        "good": bot._getGood(),
        "select3": [p.index for p in bot.select(players, 3)],
    }


snapshots = [snapshot("initial")]
bot.onVoteComplete([True] * 5)
snapshots.append(snapshot("first votes"))
bot.onMissionComplete(1)
snapshots.append(snapshot("first raid"))
bot.game.turn = 2
bot.game.leader = players[2]
bot.game.team = players[2:]
bot.onVoteComplete([False, True, True, False, True])
snapshots.append(snapshot("second votes"))
bot.onMissionComplete(0)
snapshots.append(snapshot("second raid"))
(root / "reference.json").write_text(json.dumps(snapshots, indent=2) + "\n")
for item in snapshots:
    print(item["name"], item["badGroup"], item["select3"])
