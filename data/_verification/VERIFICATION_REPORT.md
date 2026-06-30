# fcPicker — FC data verification report

Cross-correlated **301 boards** (258 hardware clusters) across hwdef + README + local ArduPilot wiki + manufacturer sites.

## Summary of what was applied
- Manufacturer + marketing name + chips + physical specs written to each board's `ai` block (301/301).
- 22 `docs_url` corrections applied via `data/docs_overrides.json` (wrong-variant / wrong-product wiki links).
- Parser fixes already in place: `undef` sensor handling (16 boards) + deterministic wiki matching.

## A. docs_url corrected (wrong board/variant → right page)
| Board(s) | Now points to |
|---|---|
| CubeBlack | common-thecube-overview |
| F35Lightning | common-furiousfpv-f35 |
| Pixhawk5X | common-holybro-ph5x |
| SkystarsH7HD, SkystarsH7HD-bdshot | common-skystarsH7 |
| mRoCZeroOEMH7-bdshot | common-3DR_Control_Zero_OEM_G |
| mRoControlZeroOEMH7 | common-3DR_Control_Zero_OEM_G |
| skyviper-v2450 | skyrocket |
| CUAVv5, CUAVv5-bdshot | common-pixhackV5-overview |
| CubeBlack+ | common-thecube-overview |
| MambaF405US-I2C | common-mamba-basic-mk3 |
| SULILGH7-P1-P2 | common-suligh7 |
| fmuv5 | common-pixhackV5-overview |
| speedybeef4v4 | common-speedybeef4-v3 |
| BlitzF745AIO | common-iflight-blitzf7AIO |
| MambaF405v2 | common-mamba405-mk2 |
| NarinFC-H5 | common-NarinFC-H7 |
| TMotorH743 | common-tmotor-h7-mini |
| skyviper-f412-rev1 | skyviper |
| AIRLink | common-skydrones-airlink |
| skyviper-journey | skyrocket |

### Flagged wrong but NO correct wiki page found (needs manual check / maybe clear link)
`DAKEFPVH743_SLIM, TBS_LUCID_H7_WING_AIO, MatekF405-CAN, PixFlamingo, VRBrain-v54, YJUAV_A6, mRoControlZeroClassic, ACNS-F405AIO, JHEMCUF405WING, SDMODELH7V1, speedybeef4v5, JHEM_JHEF405, MicoAir743-Lite, Pixhawk4, VRBrain-v51, mRoControlZeroH7`

## B. Chip mislabels — our data shows the hwdef driver-alias, real part differs
| Board | Field | our value (alias) | real part (README/wiki) |
|---|---|---|---|
| 3DRControlZeroG | imu_models | BMI088, icm20608 alias (CS=ICM_206 | BMI088, ICM20602, ICM20948 |
| 3DRControlZeroG | baro_models | dps310 (driver alias) | DPS368 |
| AEROFOX-H7 | imu_models | ADIS16470 + Invensensev3(42688_1)  | ADIS16470 (advanced), ICM45686 (ad |
| AEROFOX-H7 | baro_models | SPL06 or BMP280 (comment) | SPL06-001 only |
| ARKV6X | mcu_part | STM32H743xx (family) | STM32H743IIK6 |
| ARKV6X | baro_models | BMP388 (driver alias) | BMP390 |
| AcctonGodwit_GA1 | mcu_part | STM32H743xx (device class) | STM32H753IIK |
| BETAFPV-F405 | imu_models | IMU Invensensev3 (driver alias, no | ICM42688-P |
| BROTHERHOBBYH743 | imu_models | Invensensev3 (x2) + BMI088 (x2) —  | ICM42688P |
| BeastH7v2 | imu_models | BMI270 (SPI:bmi270 alias on MPU600 | BMI270 |
| BeastH7v2 | baro_models | DPS310 on I2C:0:0x76, HAL_BARO_ALL | DPS310 or None |
| CBU-H7-Stamp | mcu_part | STM32H743xx (family) | STM32H743IIK6 |
| CBU-H7-Stamp | baro_models | BMP280 I2C:1:0x76 | BMP280 (Sensors section) / DPS310  |
| CUAV-7-Nano | mcu_part | STM32H743xx (build class) | STM32H753 |
| CUAV-X7 | imu_models | ADIS1647x, Invensensev3/icm42688,  | X7: BMI088+ICM20689+ICM20649; X7 P |
| CUAV-X7 | compass_models | IST8310 (I2C ALL_EXTERNAL and ALL_ | RM3100 Compass (family table) |
| CubeBlack | imu_models | Invensense mpu9250_ext, LSM9DS0 ls | Two MPU9250 and one LSM303D/L3GD20 |
| CubeBlack | compass_models | COMPASS LSM303D, AK8963:probe_mpu9 | builtin SPI LSM303D magnetometer;  |
| CubePurple | imu_models | MPU9250 (original) + ICM20948 (new | 1x InvenSense MPU9250 only |
| CubePurple | compass_models | AK09916 probed from ICM20948 (expl | not specified |
| CubeYellow | imu_models | Bus aliases: icm20602_ext (Invense | ICM20602, ICM20948, ICM20649 (Cube |
| DAKEFPVH743_SLIM | imu_models | Invensensev3 (x2, family alias) | Dual ICM42688 |
| DAKEFPVH743_SLIM | osd_chip | OSD_TYPE_DEFAULT 1 (MAX7456 driver | AT7456E (features) / MAX7456 (OSD  |
| FlywooF405HD-AIOv2 | baro_models | BARO BMP280 I2C:0:0x76 and BARO DP | DPS310/SPL06 |
| FlywooF405HD-AIOv2 | osd_chip | SPIDEV osd on SPI3/OSD1_CS; HAL_OS | OSD_TYPE 5 (MSP DisplayPort) |
| FlywooF745Nano | imu_models | mpu6000/bmi270/icm42688 (aliases) | MPU6000 or ICM42668P |
| GEPRCF745BTHD | osd_chip | SPI4/MAX7456_CS (CS pin name only) | AT7456E |
| JFB100 | mcu_part | STM32F7xx/STM32F767xx (build class | STM32F765 |
| JPilot-C | baro_count | 1 active (DPS280); 1 commented out | 2x barometer |
| KakuteF4Mini | imu_models | SPIDEV alias 'mpu6000', CS pin nam | MPU6000 |
| KakuteH7-Wing | imu_models | BMI088 + ICM42688 | ICM42688 only |
| LongBowF405WING | mcu_part | STM32F4xx / STM32F405xx (family on | STM32F405 168MHz |
| MambaF405-2022 | imu_models | Invensense SPI:mpu6000 (parent) +  | MPU6000 only (Version A baseline) |
| MambaF405-2022 | baro_models | BMP280 (parent) + SPL06 (2022 over | SPL06 Barometer only |
| NarinFC-X3 | baro_models | DPS310 (driver label, comment: 'DP | DPS368XTSA1 |
| OMNIBUSF7V2 | mcu_part | STM32F745xx (family only) | STM32F745VG ARM |
| OMNIBUSF7V2 | imu_models | ICM-20608 (SPI1/mpu6000 alias, per | MPU6000 + ICM-20608 |
| OrqaH7QuadCore | imu_models | Invensensev3 (driver alias) | dual ICM42688 |
| PixPilot-V3 | imu_models | ICM42688 x2, ICM40605 x1 (bus alia | ICM42688-P x2, ICM40605 x1 |
| PixSurveyA2-IND | imu_models | Invensensev3 x3 with SPIDEV aliase | 2x ICM-42652 (SPI), 1x ICM-42688-P |
| Pixhawk5X | mcu_part | STM32F767xx | STM32F765 |
| PrincipIoTH7Pi | baro_models | DPS310 I2C:0:0x76 (driver alias) | Infineon DPS368 |
| SIYI_N7 | imu_models | ICM20689 + ICM45686 (same CS, hw v | ICM20689 and BMI088 |
| SpeedyBeeF405WING | imu_models | alias icm42605 (comment: ICM42688P | ICM42688P |
| TBS_LUCID_H7_WING_AIO | mcu_part | STM32H743xx (family alias) | STM32H743VIH6 |
| VUAV-TinyV7 | imu_models[0] | Invensensev3 (driver alias 'imu1') | ICM45686 |
| VUAV-TinyV7 | compass_models | IST8310, QMC5883L | IST8310 (only this mentioned) |
| YARIV6X | mcu_part | STM32H743xx (family alias) | STM32H743IIK6 (480MHz, 2MB Flash,  |
| YJUAV_A6Ultra | imu_models | Invensense / Invensensev3 (3 slots | ICM42688, ICM42688, IIM42652 |
| YJUAV_A6Ultra | compass_models | IST8310 | ITS8310 (misprint) |
| mRoCZeroOEMH7-bdshot | imu_models | BMI088 + ICM20602 (comment: ICM206 | Board data chip_display reads ICM2 |
| mRoCZeroOEMH7-bdshot | baro_models | DPS310 (BARO line + SPIDEV alias + | DPS368 (wiki is for OEM G revision |
| mRoControlZeroOEMH7 | baro_models | DPS310 (comment + driver alias) | DPS368 |
| mini-pix | mcu_part | STM32F405xx (family) | STM32F405VGT6 |
| mini-pix | imu_models | SPIDEV alias 'mpu6000' (legacy); c | InvenSense MPU6500 |
| mini-pix | baro_models | LPS2XH driver / lps22h alias; CS p | LPS22HB |
| omnibusf4pro-one | imu_models | Invensense SPI:mpu6000 OR BMI270 S | InvenSense MPU6000 IMU only |
| revo-mini-i2c | compass_models | COMPASS HMC5843 I2C:0:0x1E (driver | Honeywell HMC5883L |
| skyviper-v2450 | imu_models | IMU Invensense SPI:mpu6000 (mpu600 | ICM20789 IMU including 3-axis acce |
| speedybeef4v3 | baro_models | SPL06 (BARO SPL06 I2C:0:0x76, AP_B | DPS280 (incorrect) |

## C. hwdef README errors (candidates to PR upstream to ArduPilot)
| Board | Issue |
|---|---|
| AEROFOX-H7 | SPIDEV alias '42688_2' implies ICM42688 but README explicitly states the second slot is ICM45686 on the advanced version; the Invensensev3 driver supports both, |
| BETAFPV-F405 | Wiki AIO section lists 'BMP210/DPS310' as baro but hwdef only enables BMP280 and SPL06 drivers; 'BMP210' appears to be a wiki typo (likely BMP280), and SPL06 dr |
| BeastH7v2 | Wiki calls the barometer DSP310 (typo for DPS310) and states it is absent in V2; README/hwdef indicate DPS310 is present in SOME V2 units (firmware configured w |
| CBU-H7-Stamp | hwdef.dat comment at line 100 says 'IMU1 ICM-42760-P' but the SPIDEV alias is icm42670, max SPI speed is 8MHz (matching ICM-42670 limit), and both README and wi |
| CubeBlack | hwdef README (CubeBlack/README.md) compass section incorrectly states 'One is a HMC5843'; the hwdef.dat COMPASS driver lines show LSM303D (from LSM9DS0), AK8963 |
| JHEMCU-H743HD | Current JSON uart_count=8 is misleading: hwdef defines UART8 but README and wiki explicitly state 7 accessible UARTs; UART8 has no pinout and requires soldering |
| NarinFC-X3 | README and wiki features table incorrectly states '5 x UART' and '12 x PWM'; hwdef SERIAL_ORDER defines 7 hardware UARTs and 13 PWM outputs — those same documen |
| ReaperF745 | Flash size conflict: hwdef README.md says '128MBit' (16MB) but wiki common-foxeerf745aio says '16Mbit' (2MB) — wiki value is likely a typo; README is more autho |
| TBS_LUCID_H7_WING_AIO | Our JSON data records pwm.fmu=13 and pwm.total=13, but the AIO hwdef.dat undefs 5 PWM channels (PD13/14/15=PWM8-10, PE5/6=PWM11-12) from the parent's 13, leavin |
| TBS_LUCID_H7_WING_AIO | The AIO README features header says '13x PWM (including LED)' but the AIO README's own PWM Output section says 'up to 8 PWM or DShot outputs' with 5 groups tota |
| mRoCZeroOEMH7-bdshot | Wiki Servo/Motor section mentions 'KakuteH7' and describes different serial assignments (UART5, USART6) than what the hwdef defines (UART7 as SERIAL5); the wiki |
| mRoControlZeroOEMH7 | Wiki serial/UART mapping section contains copy-paste artifacts from a KakuteH7 page (mentions UART5, USART6, and 'KakuteH7 supports up to 14 PWM') that do not a |
| speedybeef4v3 | README.md incorrectly lists 'DPS280 barometer' for this board; hwdef.dat specifies BARO SPL06 with AP_BARO_SPL06_ENABLED, and the wiki confirms V3 uses SPL06 (D |
| BETAFPV-F405-I2C | Baro ambiguity: parent hwdef/README probes BMP280+SPL06 at same CS address; I2C-variant README says DPS310 (handled by SPL06 driver); wiki AIO row says BMP210/D |
| BlitzF745 | Wiki (common-blitz-f745.rst) states '19V, 2A BEC for powering Video Transmitter' — manufacturer page confirms a 9V, 2.5A BEC; '19V' appears to be a typo in the  |
| CORVON405V2_1 | README.md and wiki OSD Support narrative sections say 'MAX7456' but Features list (both README and wiki) and hwdef CS pin name (AT7456E_CS) say AT7456E — AT7456 |
| QioTekAdeptF407 | README Features section lists 'USART7' among the 5 UARTs but hwdef.dat and the README's own UART Mapping table both show USART6 — README typo, data is correct |
| QioTekAdeptF407 | hwdef.dat comment header says 'QioTekZealotF407' but board is 'QioTekAdeptF407' — copy-paste artifact in hwdef header comment |
| ResoluteH7 | hwdef.dat comment for SPI1 spells the IMU as 'ICM62688' which is a typo; all other references (SPIDEV alias, README, wiki) confirm ICM42688. |
| SULILGH7-P1-P2 | README and wiki PWM section erroneously names 'STM32H753 FMU controller'; the MCU section in both sources and the hwdef.dat correctly identify the processor as  |
| StellarF4 | README Loading Firmware section incorrectly references sub-folder 'StellarH7V2'; wiki correctly says 'StellarF4' — copy-paste error in README |
| YJUAV_A6 | README UART mapping table says 'SERIAL5 -> UART6 (SBUS)' but hwdef configures UART8 (not UART6) for the SBUS/DSM port — README contains a typo |
| ACNS-F405AIO | README names the MCU as STM32F405RET (512KB flash) but hwdef.dat sets FLASH_SIZE_KB 1024, which corresponds to STM32F405RGT (1024KB flash); README likely contai |
| BOTWINGF405 | hwdef.dat comment says 'W25Q128' (16MB) but README.md and wiki both specify W25Q256 (32MB); hwdef comment is likely a copy-paste error — README/wiki consensus i |
| CORVON743V1 | README/wiki list '1 I2C' under features, but hwdef defines 2 I2C buses (I2C2 for internal baro+compass, I2C1 for external connector) — README is counting only t |
| CUAV-V6X-v2 | worldronemarket user manual contains a typo: IMU listed as ICM-42686 rather than ICM-45686; hwdef and manufacturer product pages confirm ICM45686 |
| DAKEFPVH743 | Wiki features list '1x CAN port' is shared for both H743 and H743 Pro without distinguishing that the non-Pro lacks CAN — this is misleading in the shared RST p |
| FlywooF405S-AIO | README battery monitoring section states voltage sensor handles '2S to 6S' but the features list and product title both say '1-2S'; the 2-6S claim is a template |
| MFT-SEMA100 | Compass chip name: README and wiki both spell it 'LIB3MDL' (typographical error); hwdef and data JSON correctly identify it as 'LIS3MDL'. |
| QioTekZealotF427 | baro driver named 'DPS280' (ArduPilot family driver) but SPIDEV alias is 'dps310' and README says DPS310 — wiki reads 'DPS3018' which appears to be a typo for D |
| SPEDIXH743 | README PWM Output section (and wiki copy) incorrectly refers to 'SPEDIX F405' instead of 'SPEDIX H743' — likely a copy-paste error from the SPEDIX F405 document |
| VRCore-v10 | hwdef SPIDEV alias is 'mpu9250' but IMU driver line references 'SPI:mpu6000'; the original hardware author (Laser Navigation) explicitly named the device 'mpu92 |
| YJUAV_A6SE | README has typo 'ITS8310' for the onboard magnetometer; correct part number is IST8310 per hwdef and wiki. |
| AEDROXH7 | README.md incorrectly states 'Onboard OSD using OSD_TYPE 1 (MAX7456 driver)' — this is a copy-paste error from another board; hwdef sets HAL_OSD_TYPE_DEFAULT=5  |
| AEDROXH7 | README PWM section mistakenly refers to 'SPEDIX F405' — clear copy-paste error; wiki corrects this to generic 'autopilot' |
| BeastH7 | Wiki has typo 'DSP310' for the barometer; correct part is DPS310 (confirmed by hwdef BARO line and README) |
| CBU-H7-LC-Stamp | hwdef.dat comment reads '# IMU1 ICM-42760-P' but the actual chip is ICM-42670 (confirmed by driver alias 'icm42670' and README); hwdef comment appears to be a t |
| CrazyF405 | wiki compass section incorrectly names BETAFPV F405 AIO instead of CrazyF405HD (copy-paste error in wiki) |
| FoxeerH743v1 | Wiki dimensions field reads '37mm x 372mm x 19mm' - the second value (372mm) is an obvious data-entry typo; board length/width cannot be confirmed from local so |
| HEEWING-F405 | README spells the barometer 'SLP06' (typo); correct part designation is SPL06 as used in hwdef.dat and wiki. |

## D. Wiki outdated vs current production (candidates to update the wiki)
| Board | Issue |
|---|---|
| JHEMCUF405PRO | Current vendor web pages for 'updated' GHF405-HD and GHF405 PRO SKUs list ICM42688-P, while hwdef.dat and README/wiki define ICM42605 — the JHEMCUF405PRO ArduPi |
| KakuteF7 | Wiki specifications section says '5x UARTs/serial' but the UART mapping table in the same page lists 6 serial ports (SERIAL1-SERIAL6 = UART1/2/3/4/7/6). hwdef S |
| BlitzH743Pro | README.md battery monitoring section says 'voltage sensor can handle up to 6S' but the features section says 2S-8S; wiki consistently states 2S-8S and up to 8S  |
| MUPilot | README and wiki list 'MPU6000' as the second IMU, but the hwdef CS pin is named ICM20602_CS and the driver entry is 'Invensense SPI:icm20602'; ICM20602 and MPU6 |
| MatekH743 | Wiki page (common-matekh743-wing.rst) lists only MPU6000+ICM20602 (V1-era hardware) but hwdef comments show V1.5/V2 ships ICM42605+MPU6000 and V3 ships ICM42688 |
| mRoControlZeroH7 | docs_url (store.mrobotics.io store page) now issues a 302 redirect to store.3dr.com homepage and no longer identifies this specific board; no dedicated ArduPilo |
| omnibusf4pro | Wiki (common-omnibusf4pro.rst) lists only InvenSense MPU6000 as IMU; hwdef.dat also defines BMI270 for newer board revisions (both share CS pin PA4, alternate h |

## E. Possible parser / build-count issues (to investigate in tools/build.py)
| Board | Issue |
|---|---|
| AnyleafH7 | stored uart_count=7 is wrong: hwdef SERIAL_ORDER has 6 active HW UART buses (USART1, USART2, USART3, UART4, UART7, UART8); #OTG2 is commented out and inactive |
| BETAFPV-F405 | power.monitor_inputs=0 in current data but board has integrated voltage and current sensing (ADC pins PC2/PC1) |
| BeastH7v2 | JSON io.pwm.fmu=7 and total=7 but hwdef (max PWM index is 5) and README both state 5 PWM outputs (4 motors + 1 NeoPixel LED); build.py appears to be miscounting |
| CubeNode-ETH | can_count in data is 2 but only CAN1 is electrically configured — CAN2 pins (PB5/PB6) are commented out in CubeNode/hwdef.dat; can_count should be 1 |
| DAKEFPVH743_SLIM | our data shows power.monitor_inputs: 0 but hwdef.dat configures HAL_BATT_VOLT_PIN and HAL_BATT_CURR_PIN (voltage + current sense present) |
| F35Lightning | current data has power.monitor_inputs=0 but hwdef defines both BATT_VOLTAGE_SENS and BATT_CURRENT_SENS ADC pins |
| FlyingMoonF407 | can_count in current data is 1 but both CAN1 pin lines (PD0 CAN1_RX, PD1 CAN1_TX) are explicitly commented out in hwdef.dat — the build script regex matches the |
| HEEWING-F405v2 | Data file shows pwm.fmu=10 and pwm.total=10, but hwdef PA15/PWM(10) is commented '# no output' and marked NODMA; README and wiki both state 9 PWM outputs — usab |
| JPilot-C | README.md advertises '2x barometer' but only 1 (DPS280) is enabled in hwdef.dat; the second baro footprint (ICP201XX on SPI2/BARO2_CS at PE2) is entirely commen |
| TBS_LUCID_H7_WING_AIO | Our JSON data records pwm.fmu=13 and pwm.total=13, but the AIO hwdef.dat undefs 5 PWM channels (PD13/14/15=PWM8-10, PE5/6=PWM11-12) from the parent's 13, leavin |
| VRBrain-v52 | json io.pwm.fmu=14 and total=14 but hwdef has only 12 active PWM channels (PWM13 on PE5/TIM9_CH1 and PWM14 on PE6/TIM9_CH2 are commented out with #) |
| omnibusf4pro-one | Current data has power.monitor_inputs = 0 — hwdef defines both BAT_VOLT_SENS (PC2/ADC1) and BAT_CURR_SENS (PC1/ADC1), so monitor_inputs should be 2 |
| ACNS-CM4Pilot | Current data shows pwm.fmu=9 and total=9 but README and wiki both specify 8 motor/servo PWM outputs; 9th entry in hwdef is buzzer on TIM1 GPIO(77) which is not  |
| ACNS-CM4Pilot | Current data shows power.monitor_inputs=0 but hwdef defines BATT_VOLTAGE_SENS (PC1) and BATT_CURRENT_SENS (PC2) ADC pins and README specifies 1 analog power por |
| ACNS-CM4Pilot | Current data does not capture 128MB onboard SPI flash (PA14 FLASH_CS; SPIDEV dataflash on SPI3); README states '128M flash on board for logging' though HAL_LOGG |
| Aocoda-RC-H743Dual | data/boards JSON has power.monitor_inputs: 0 — board has 2 independent voltage+current monitors (BATT and BATT2, both wired in hwdef with dedicated ADC pins) |
| BeastF7 | current catalog JSON has power.monitor_inputs=0 but board has built-in voltage+current sensing (PC3/PC2 ADC pins in hwdef) |
| CUAVv5 | Our data lists io.pwm.total=16 and io.pwm.fmu=8 but README explicitly states 14 total outputs (8 MAIN via IOMCU + 6 AUX via FMU) — the 2 extra FMU timers (TIM12 |
| GEPRC_TAKER_H743 | Current data has power.monitor_inputs=0 despite hwdef clearly defining BATT_VOLTAGE_SENS and BATT_CURRENT_SENS ADC pins |
| GEPRC_TAKER_H743 | Local sources (hwdef/README/wiki) only confirm 'up to 6S' maximum; manufacturer specifies 3-6S minimum — current data does not capture minimum cell count |
| HWH7 | power.monitor_inputs is 0 in current data; hwdef defines built-in analog voltage+current monitor (ADC on PC0/PC1) |
| JHEMCUF405PRO | board data: power.monitor_inputs is 0 — board has onboard voltage and current sensing (BATT_MONITOR=4 in hwdef) |
| ORBITH743 | current data has power.monitor_inputs=0 but the board exposes 2 fully-wired independent power monitors (BATT and BATT2) per hwdef ADC pin assignments and README |
| QioTekAdeptF407 | data: power.monitor_inputs=0 but hwdef defines two battery voltage/current monitor pairs (BATT_VOLTAGE_SENS/BATT_CURRENT_SENS + BATT2_VOLTAGE_SENS/BATT2_CURRENT |
| ResoluteH7 | Battery monitoring: board JSON shows power.monitor_inputs=0 but hwdef defines two ADC pins (BATT_VOLTAGE_SENS PC0, BATT_CURRENT_SENS PC1) with HAL_BATT_MONITOR_ |
| SkyRukh_Surge_H7 | data/boards/SkyRukh_Surge_H7.json has power.monitor_inputs: 0 — hwdef defines BATT_VOLT_PIN and BATT_CUR_PIN (internal voltage + current via ESC connector) |
| SkystarsH7HDv2 | JSON io.pwm.fmu=18 is wrong; hwdef defines PWM(1)-PWM(9) totaling 9 outputs, confirmed by README ('9 PWM outputs') and wiki |
| TBS_LUCID_PRO | PWM output count in current data shows fmu=8 (total=8) but hwdef.dat only enables 6 outputs (PWM 7 and 8 are commented out); README and wiki confirm 6x PWM outp |
| VRBrain-v54 | io.pwm.fmu is 14 in data but hwdef has only 12 active PWM channels (PWM1-12); PWM13 (PE5) and PWM14 (PE6) are commented out — build.py parser appears to include |
| modalai_fc-v1 | README lists BMI088 as a third IMU (SPI6) but it is disabled/commented out in hwdef.dat due to lack of DMA channels; our active IMU list correctly omits it but  |
| ACNS-F405AIO | current JSON has pwm.fmu=10 and pwm.total=10, but hwdef.dat only defines 8 active PWM outputs — PWM(9) and PWM(10) lines are commented out |
| AIRBRAINH743 | Our JSON shows spi_count=2 with [SPI1, SPI2] but hwdef.dat defines three SPI buses: SPI1 (IMU), SPI2 (dataflash), and SPI4 (AUX, no device attached). |
| AIRBRAINH743 | Our JSON shows power.monitor_inputs=0 but hwdef.dat defines both BATT_VOLTAGE_SENS and BATT_CURRENT_SENS ADC inputs with scaling constants. |
| BeastF7v2 | Current data pwm.fmu=7 is wrong: hwdef, README, wiki, and defaults.parm all confirm exactly 5 PWM outputs (4 motor + 1 LED on ch5) |
| CORVON743V1 | JSON power.monitor_inputs=0 but hwdef configures BATT_VOLT_PIN=10 (PC0) and BATT_CURR_PIN=11 (PC1) — build.py likely fails to count ADC-based battery monitors f |
| DAKEFPVH743 | JSON pwm.fmu=24 is likely a build-script artifact from not resolving `undef` directives; hwdef analysis yields 14 total PWM outputs (M1-8 + S1-4 + OSD + LED); R |
| FoxeerF405v2 | Our data power.monitor_inputs=0 but hwdef.dat defines both a voltage sense pin (PC0) and a current sense pin (PC1) as ADC inputs |
| JHEMCUF405WING | power.monitor_inputs is 0 but hwdef defines BATT_VOLTAGE_SENS and BATT_CURRENT_SENS and README lists built-in voltage and current sensor |
| KakuteF4 | Current JSON io.pwm.fmu=5 but README and wiki both say 4 PWM motor outputs; hwdef.dat 5th PWM entry (PC8 TIM8_CH3) is the LED strip pad, not a motor output |
| KakuteF7Mini | JSON io.pwm.fmu is 8 but hwdef.dat defines only 6 PWM outputs (PWM1-PWM6, M1-M6) and README and wiki both confirm 6 outputs |
| KakuteF7Mini | JSON power.monitor_inputs is 0 but hwdef.dat defines onboard BATT_VOLTAGE_SENS (PC3) and BATT_CURRENT_SENS (PC2) ADC pins — board has integrated current+voltage |
| MFT-SEMA100 | Power monitoring: data JSON shows monitor_inputs=0 but hwdef clearly defines BATT_VOLTAGE_SENS and BATT_CURRENT_SENS ADC pins with HAL_BATT_MONITOR_DEFAULT=4. |
| MatekF765-Wing | CAN count wrong in board JSON (shows 1): hwdef.dat has CAN1_TX/CAN1_RX on PD0/PD1 explicitly commented out with note 'disabled as used for UART4'; no active CAN |
| MazzyStarDrone | io.pwm.fmu is 8 in current data but only 6 PWM outputs are active in hwdef.dat; PWM(7) and PWM(8) are commented out (those pins are shared with LED and buzzer) |
| NucleoH755 | Current JSON spi_count=1 lists only SPI3, but hwdef.dat defines pins for both SPI1 (PA5/PA6/PA7) and SPI3 (PB3/PB4/PB5); SPI1 has no attached SPIDEV device so m |
| PilotGaeaSH7V1-bdshot | data power.monitor_inputs is 0 but board has 2 battery monitor inputs (BATT on ADC pins 10/11 and BATT2 on ADC pins 18/7) |
| QioTekZealotF427 | power.monitor_inputs is 0 in current data but board has 2 power module inputs (BATT + BATT2 with voltage and current monitoring) plus servo rail voltage monitor |
| VRCore-v10 | board data lists mcu.pwm.total=14 but only 12 PWM outputs are uncommented in hwdef (PWM 13 and 14 are commented out) |
| sparky2 | JSON power.monitor_inputs=0 is wrong; hwdef defines BATT_VOLTAGE_SENS and BATT_CURRENT_SENS ADC pins and wiki confirms '2x analog to digital inputs for battery  |
| sparky2 | JSON io.pwm.fmu=10 and io.pwm.total=10 do not match hwdef which defines only 7 PWM outputs (PWM1-7); wiki claims 6+4=10 but some of those 4 may be on LED-port p |