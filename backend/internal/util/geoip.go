package util

import (
	"log"
	"net"

	"github.com/oschwald/geoip2-golang"
)

var geoipDB *geoip2.Reader

// GeoInfo IP 地理信息
type GeoInfo struct {
	Country     string
	CountryCode string
	City        string
}

// InitGeoIP 加载 MaxMind GeoLite2 数据库
func InitGeoIP(path string) error {
	if path == "" {
		log.Println("[geoip] 未配置 GEOIP_PATH，IP 地理限制功能将不可用")
		return nil
	}
	var err error
	geoipDB, err = geoip2.Open(path)
	if err != nil {
		return err
	}
	log.Printf("[geoip] GeoIP 数据库加载成功: %s", path)
	return nil
}

// LookupIP 查询 IP 地理信息
func LookupIP(ipStr string) *GeoInfo {
	if geoipDB == nil {
		return &GeoInfo{}
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return &GeoInfo{}
	}

	record, err := geoipDB.City(ip)
	if err != nil {
		return &GeoInfo{}
	}

	city := ""
	if len(record.City.Names) > 0 {
		if c, ok := record.City.Names["zh-CN"]; ok {
			city = c
		} else if c, ok := record.City.Names["en"]; ok {
			city = c
		}
	}

	country := ""
	if c, ok := record.Country.Names["zh-CN"]; ok {
		country = c
	} else if c, ok := record.Country.Names["en"]; ok {
		country = c
	}

	return &GeoInfo{
		Country:     country,
		CountryCode: record.Country.IsoCode,
		City:        city,
	}
}

// CloseGeoIP 关闭数据库连接
func CloseGeoIP() {
	if geoipDB != nil {
		geoipDB.Close()
	}
}
