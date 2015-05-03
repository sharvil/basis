#!/usr/bin/python

import argparse
import collections
import json
import math
import os
import struct
import sys

ANGLE_FACTOR = 2 * math.pi / 40000.0
SPEED_FACTOR = 1 / 1000.0

def parseConfig(settingsFile):
  settings = {}
  curSection = None
  lines = [x.strip() for x in settingsFile.readlines()]
  for line in lines:
    if line.startswith('['):
      curSection = line[1:-1]
      settings[curSection] = {}
    elif line.find('=') != -1:
      key, value = line.split('=')
      settings[curSection][key] = value
  return settings

def convertShip(name, settings):
  radius = int(settings[name]['Radius'])
  if radius == 0:
    radius = 14

  jsonSettings = collections.OrderedDict()
  jsonSettings['name'] = name
  jsonSettings['radius'] = radius
  jsonSettings['bounceFactor'] = 16.0 / int(settings['Misc']['BounceFactor'])
  jsonSettings['rotationRadiansPerTick'] = int(settings[name]['InitialRotation']) * ANGLE_FACTOR
  jsonSettings['speedPixelsPerTick'] = int(settings[name]['InitialSpeed']) * SPEED_FACTOR
  jsonSettings['maxEnergy'] = int(settings[name]['InitialEnergy'])
  jsonSettings['accelerationPerTick'] = int(settings[name]['InitialThrust']) / 1000.0
  jsonSettings['afterburnerMaxSpeed'] = jsonSettings['speedPixelsPerTick'] * 2
  jsonSettings['afterburnerAcceleration'] = 0.02
  jsonSettings['afterburnerEnergy'] = int(settings[name]['AfterburnerEnergy']) / 1000.0
  jsonSettings['rechargeRate'] = int(settings[name]['InitialRecharge']) / 1000.0
  jsonSettings['respawnDelay'] = 500

  bullet = collections.OrderedDict()
  bullet['fireEnergy'] = int(settings[name]['BulletFireEnergy'])
  bullet['speed'] = int(settings[name]['BulletSpeed']) * SPEED_FACTOR
  bullet['fireDelay'] = int(settings[name]['BulletFireDelay'])
  bullet['lifetime'] = int(settings['Bullet']['BulletAliveTime'])
  bullet['damage'] = int(settings['Bullet']['BulletDamageLevel'])
  bullet['damageUpgrade'] = int(settings['Bullet']['BulletDamageUpgrade'])
  bullet['initialLevel'] = int(settings[name]['InitialGuns']) - 1
  bullet['maxLevel'] = int(settings[name]['MaxGuns']) - 1
  bullet['bounces'] = False

  if int(settings[name]['MultiFireAngle']) != 0:
    bullet['multifire'] = collections.OrderedDict()
    bullet['multifire']['fireEnergy'] = int(settings[name]['MultiFireEnergy'])
    bullet['multifire']['fireDelay'] = int(settings[name]['MultiFireDelay'])
    bullet['multifire']['angle'] = int(settings[name]['MultiFireAngle']) * ANGLE_FACTOR

  bomb = collections.OrderedDict()
  bomb['fireEnergy'] = int(settings[name]['BombFireEnergy'])
  bomb['fireEnergyUpgrade'] = int(settings[name]['BombFireEnergyUpgrade'])
  bomb['speed'] = int(settings[name]['BombSpeed']) * SPEED_FACTOR
  bomb['fireDelay'] = int(settings[name]['BombFireDelay'])
  bomb['lifetime'] = int(settings['Bomb']['BombAliveTime'])
  bomb['damage'] = int(settings['Bomb']['BombDamageLevel'])
  bomb['damageUpgrade'] = int(settings['Bomb']['BombDamageLevel'])
  bomb['initialLevel'] = int(settings[name]['InitialBombs']) - 1
  bomb['maxLevel'] = int(settings[name]['MaxBombs']) - 1
  bomb['blastRadius'] = int(settings['Bomb']['BombExplodePixels'])
  bomb['blastRadiusUpgrade'] = int(settings['Bomb']['BombExplodePixels'])
  bomb['proxRadius'] = int(settings['Bomb']['ProximityDistance'])
  bomb['proxRadiusUpgrade'] = int(settings['Bomb']['ProximityDistance'])
  bomb['bounceCount'] = int(settings[name]['BombBounceCount'])
  bomb['recoilAcceleration'] = int(settings[name]['BombThrust']) / 1000.0

  burst = collections.OrderedDict()
  burst['fireDelay'] = int(settings[name]['BulletFireDelay'])  # Assume burst fire delay is the same as the bullet fire delay
  burst['lifetime'] = int(settings['Bullet']['BulletAliveTime'])  # Assume burst lifetime is the same as a regular bullet
  burst['damage'] = int(settings['Bullet']['BulletDamageLevel']) + 4 * int(settings['Bullet']['BulletDamageUpgrade'])
  burst['speed'] = int(settings[name]['BurstSpeed']) * SPEED_FACTOR
  burst['shrapnelCount'] = int(settings[name]['BurstShrapnel'])
  burst['initialCount'] = int(settings[name]['InitialBurst'])
  burst['maxCount'] = int(settings[name]['BurstMax'])

  jsonSettings['bullet'] = bullet
  jsonSettings['bomb'] = bomb
  jsonSettings['burst'] = burst

  return jsonSettings

def convertToJson(settings):
  jsonSettings = collections.OrderedDict()
  jsonSettings['game'] = collections.OrderedDict({
    'killPoints': 20,
    'maxTeams': 2
  })
  jsonSettings['network'] = collections.OrderedDict({
    'sendPositionDelay': int(settings['Misc']['SendPositionDelay']),
    'fastSendPositionDelay': max(1, int(settings['Misc']['SendPositionDelay']) / 4)
  })
  jsonSettings['map'] = collections.OrderedDict({
    'width': 1024,
    'height': 1024,
    'spawnRadius': 500
  })
  jsonSettings['prize'] = collections.OrderedDict({
    'decayTime': 18000,
    'count': 50,
    'radius': 128,
    'weights': [1, 0, 0, 0, 0, 0]
  })
  jsonSettings['ships'] = [
    convertShip('Warbird', settings),
    convertShip('Javelin', settings),
    convertShip('Spider', settings),
    convertShip('Leviathan', settings),
    convertShip('Terrier', settings),
    convertShip('Weasel', settings),
    convertShip('Lancaster', settings),
    convertShip('Shark', settings)
  ]
  return jsonSettings

def main():
  parser = argparse.ArgumentParser(description = 'Converts a SubSpace server.cfg file to a dotproduct settings file.')
  parser.add_argument('settingsFile', type=argparse.FileType('rb'))
  args = parser.parse_args()

  settings = parseConfig(args.settingsFile)
  jsonSettings = convertToJson(settings)
  print json.dumps(jsonSettings, indent = 2)

if __name__ == '__main__':
  main()
