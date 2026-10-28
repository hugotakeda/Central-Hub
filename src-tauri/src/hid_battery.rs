//! USB HID Usage Tables: Generic Device Controls (06), Battery Strength (20).
//! Only feature fields; never consumes normal keyboard/mouse input events.
use std::collections::HashMap;
#[derive(Clone, Default)]
struct Global {
    page: u32,
    min: i32,
    max: i32,
    size: u32,
    count: u32,
    id: u8,
}
#[derive(Debug)]
pub struct Field {
    pub id: u8,
    pub report_len: usize,
    offset: usize,
    size: usize,
    min: i32,
    max: i32,
}
impl Field {
    pub fn percent(&self, report: &[u8]) -> Option<u8> {
        if report.first().copied() != Some(self.id) || report.len() < self.report_len + 1 {
            return None;
        }
        let mut value = 0u32;
        for bit in 0..self.size {
            let at = self.offset + bit;
            value |= u32::from((report[1 + at / 8] >> (at % 8)) & 1) << bit;
        }
        let value = if self.min < 0 {
            ((value << (32 - self.size)) as i32) >> (32 - self.size)
        } else {
            value as i32
        };
        if value < self.min || value > self.max {
            return None;
        }
        Some(
            ((i64::from(value - self.min) * 100 + i64::from(self.max - self.min) / 2)
                / i64::from(self.max - self.min)) as u8,
        )
    }
}
pub fn fields(raw: &[u8]) -> Vec<Field> {
    if raw.len() > 16384 {
        return vec![];
    }
    let mut g = Global::default();
    let mut stack = vec![];
    let mut offsets = HashMap::<u8, usize>::new();
    let mut usages = Vec::<u32>::new();
    let mut range: Option<u32> = None;
    let mut result = vec![];
    let mut at = 0;
    while at < raw.len() {
        let prefix = raw[at];
        at += 1;
        if prefix == 0xfe {
            return vec![];
        }
        let len = match prefix & 3 {
            3 => 4,
            n => n as usize,
        };
        if at + len > raw.len() {
            return vec![];
        }
        let bytes = &raw[at..at + len];
        at += len;
        let value = bytes
            .iter()
            .enumerate()
            .fold(0u32, |v, (i, b)| v | (u32::from(*b) << (i * 8)));
        let signed = if len == 0 {
            0
        } else {
            ((value << ((4 - len) * 8)) as i32) >> ((4 - len) * 8)
        };
        let tag = prefix >> 4;
        let typ = (prefix >> 2) & 3;
        match (typ, tag) {
            (1, 0) => g.page = value,
            (1, 1) => g.min = signed,
            (1, 2) => {
                g.max = if g.min < 0 {
                    signed
                } else {
                    value.min(i32::MAX as u32) as i32
                }
            }
            (1, 7) => g.size = value,
            (1, 8) => {
                if value == 0 || value > 255 {
                    return vec![];
                }
                g.id = value as u8;
            }
            (1, 9) => g.count = value,
            (1, 10) => {
                if stack.len() >= 16 {
                    return vec![];
                }
                stack.push(g.clone());
            }
            (1, 11) => {
                let Some(saved) = stack.pop() else {
                    return vec![];
                };
                g = saved;
            }
            (2, 0) => {
                if usages.len() >= 1024 {
                    return vec![];
                }
                usages.push(if len == 4 {
                    value
                } else {
                    (g.page << 16) | value
                });
            }
            (2, 1) => range = Some(value),
            (2, 2) => {
                if let Some(first) = range.take() {
                    if value < first || value - first > 1024 {
                        return vec![];
                    }
                    usages.extend((first..=value).map(|u| (g.page << 16) | u));
                }
            }
            (0, 11) => {
                if g.size > 32 || g.count > 1024 {
                    return vec![];
                }
                let offset = offsets.entry(g.id).or_default();
                let bits = (g.size as usize) * (g.count as usize);
                if *offset + bits > 8192 {
                    return vec![];
                }
                if value & 3 == 2 && g.size > 0 && g.size <= 16 && g.max > g.min && g.min >= 0 {
                    for index in 0..g.count as usize {
                        let usage = usages.get(index).or(usages.last());
                        if usage == Some(&0x00060020) {
                            result.push(Field {
                                id: g.id,
                                report_len: 0,
                                offset: *offset + index * g.size as usize,
                                size: g.size as usize,
                                min: g.min,
                                max: g.max,
                            });
                        }
                    }
                }
                *offset += bits;
                usages.clear();
                range = None;
            }
            (0, _) => {
                usages.clear();
                range = None;
            }
            _ => {}
        }
    }
    if !stack.is_empty() {
        return vec![];
    }
    for field in &mut result {
        field.report_len = offsets.get(&field.id).copied().unwrap_or(0).div_ceil(8);
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn extracts_declared_battery_with_padding_and_null_state() {
        let raw = [
            0x05, 6, 0x09, 1, 0xa1, 1, 0x85, 7, 0x75, 4, 0x95, 1, 0xb1, 1, 0x09, 0x20, 0x15, 0,
            0x25, 10, 0x75, 4, 0xb1, 0x42, 0xc0,
        ];
        let fs = fields(&raw);
        assert_eq!(fs.len(), 1);
        assert_eq!(fs[0].percent(&[7, 0x50]), Some(50));
        assert_eq!(fs[0].percent(&[7, 0xf0]), None);
        assert_eq!(fs[0].percent(&[8, 0x50]), None);
        assert_eq!(fs[0].percent(&[7]), None);
    }
    #[test]
    fn input_or_constant_battery_is_not_queried_as_feature() {
        assert!(
            fields(&[0x05, 6, 0x09, 0x20, 0x15, 0, 0x25, 100, 0x75, 8, 0x95, 1, 0x81, 2])
                .is_empty()
        );
        assert!(
            fields(&[0x05, 6, 0x09, 0x20, 0x15, 0, 0x25, 100, 0x75, 8, 0x95, 1, 0xb1, 1])
                .is_empty()
        );
        assert!(fields(&[0x75]).is_empty());
    }
}
