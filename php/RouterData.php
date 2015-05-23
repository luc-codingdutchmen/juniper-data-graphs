<?php
error_reporting(0);
require_once('config.php');

class RouterData {
    static $pdo = null;

    static function run($host, $time) {
        printf("run: %d\n", $time);
        $community = "public";

        $interfaces_snmp = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.2");
        $interfaces_descr = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.31.1.1.1.18");
	$descriptions = [];
	$interfaces = [];

        foreach ($interfaces_descr as $key => $value) {
	    $dotpos = strrpos($key, '.');
	    $id = substr($key, $dotpos+1 , strlen($key) - $dotpos);
   	    $descr = trim(substr($value, 8));

	    $descriptions[$id] = trim($descr);
	}

        foreach ($interfaces_snmp as $key => $value) {
            $dotpos = strrpos($key, '.');
            $id = substr($key, $dotpos+1 , strlen($key) - $dotpos);
   	    $ifname = trim(substr($value, 8));
	    if(strlen($descriptions[$id]) > 0) {
	        $ifname .= sprintf(" (%s)", $descriptions[$id]);
	    }

	    $interfaces[$id] = [
                "numeric_id" => $id,
                "name" => $ifname
            ];
        }

        $sysname = trim(substr(snmp2_get($host, $community, ".1.3.6.1.2.1.1.5.0"), 8));
	
        $if_oper_status_snmp = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.8");
        $if_admin_status_snmp = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.7");
        $if_inOctets = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.10");
        $if_inUcastPkts = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.11");
        $if_inNUcastPkts = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.12");
        $if_outOctets = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.16");
        $if_outUcastPkts = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.17");
        $if_outNUcastPkts = snmp2_real_walk($host, $community, ".1.3.6.1.2.1.2.2.1.18");

        foreach ($interfaces as $key => $value) {
            $interfaces[$key]['operationStatus'] = trim(substr($if_oper_status_snmp['iso.3.6.1.2.1.2.2.1.8.' . $key], 9));
            $interfaces[$key]['adminStatus'] = trim(substr($if_admin_status_snmp['iso.3.6.1.2.1.2.2.1.7.' . $key], 9));

            $interfaces[$key]['in_bytes'] = trim(substr($if_inOctets['iso.3.6.1.2.1.2.2.1.10.' . $key], 11));
            $interfaces[$key]['in_unicast_packets'] = trim(substr($if_inUcastPkts['iso.3.6.1.2.1.2.2.1.11.' . $key], 11));
            $interfaces[$key]['in_not_unicast_packets'] = trim(substr($if_inNUcastPkts['iso.3.6.1.2.1.2.2.1.12.' . $key], 11));

            $interfaces[$key]['out_bytes'] = trim(substr($if_outOctets['iso.3.6.1.2.1.2.2.1.16.' . $key], 11));
            $interfaces[$key]['out_unicast_packets'] = trim(substr($if_outUcastPkts['iso.3.6.1.2.1.2.2.1.17.' . $key], 11));
            $interfaces[$key]['out_not_unicast_packets'] = trim(substr($if_outNUcastPkts['iso.3.6.1.2.1.2.2.1.18.' . $key], 11));  
        }

        $type = [];
        $slot = [];
        $pim_or_ioc = [];
        $port = [];
        $logical_interface = [];
        
        foreach ($interfaces as $key => $value) {
            $ifParts = static::interfaceToParts($value['name']);
            $type[$key]  = $ifParts['type'];
            $slot[$key]  = $ifParts['slot'];
            $pim_or_ioc[$key]  = $ifParts['pim-or-ioc'];
            $port[$key]  = $ifParts['port'];
            $logical_interface[$key]  = $ifParts['logical-interface'];
        }

        array_multisort(
            $type, SORT_ASC,
            $slot, SORT_ASC,
            $pim_or_ioc, SORT_ASC,
            $port, SORT_ASC,
            $logical_interface, SORT_ASC,
            $interfaces
        );

        $interfaces2 = [];
        $i=0;
        foreach ($interfaces as $key => $value) {
            $value['ifweight'] = $i++;
            $interfaces2[$value['name']] = $value;
        }
        
        static::write_data($interfaces2, $sysname, $time);
    }
        
    static function interfaceToParts($if) {
        $pattern = "/([a-z]{2,4})-?(\d)?\/?(\d)?\/?(\d+)?\.?(\d+)?/";
        $matches = [];
        preg_match($pattern, $if, $matches);

        return [
            "type" => @$matches[1] ?: null,
            "slot" => @$matches[2] ?: null,
            "pim-or-ioc" => @$matches[3] ?: null,
            "port" => @$matches[4] ?: null,
            "logical-interface" => @$matches[4] ?: null
        ];
    }
 
    static private function get_or_insert_machine_id($sysname) {
        $sysname = trim(str_replace('"', '', $sysname));

        $dbh = self::getPDO();

        $sth = $dbh->prepare(
            "SELECT
                `id`
            FROM `machine`
            WHERE `machine_name` = ?"
        );
        $sth->execute([$sysname]);
        $mysqlResult = $sth->fetchAll(PDO::FETCH_NUM);

        if(count($mysqlResult) <= 0 || false === $mysqlResult) {
            $sth = $dbh->prepare(
                "INSERT INTO `datatraffic`.`machine` (
                    `machine_name`
                ) VALUES (
                    ?
                )"
            );
            $sth->execute([$sysname]);
            return $dbh->lastInsertId();
        } else {
           return $mysqlResult[0][0];
        }

        return null;
    }
 
    static private function get_or_insert_interface_id($machine_id, $interface, $weight) {
        $interface = trim(str_replace('"', '', $interface));

        $dbh = self::getPDO();

        $sth = $dbh->prepare(
            "SELECT
                `id`
            FROM `interface`
            WHERE `machine_id` = ?
            AND `interface_name` = ?"
        );
        $sth->execute([$machine_id, $interface]);
        $mysqlResult = $sth->fetchAll(PDO::FETCH_NUM);

        if(count($mysqlResult) <= 0 || false === $mysqlResult) {
            $sth = $dbh->prepare(
                "INSERT INTO `datatraffic`.`interface` (
                    `machine_id`,
                    `interface_name`,
                    `if_weight`
                ) VALUES (
                    ?, ?, ?
                )"
            );
            $sth->execute([$machine_id, $interface, $weight]);
            return $dbh->lastInsertId();
        } else {
           return $mysqlResult[0][0];
        }

        return null;
    }

    static function write_data($data, $sysname, $timestamp) {
        $dbh = self::getPDO();

        $machine_id = self::get_or_insert_machine_id($sysname);

        $sth = $dbh->prepare(
            "INSERT INTO `datatraffic`.`traffic` (
                `machine_id`,
                `interface_id`,
                `timestamp`,
                `in_bytes`,
                `in_u_packets`,
                `in_nu_packets`,
                `out_bytes`,
                `out_u_packets`,
                `out_nu_packets`,
                `oper_status`,
                `admin_status`
            ) VALUES (
                ?, ?,
		FROM_UNIXTIME(?),
		?, ?, ?, ?, ?, ?, ?, ?
            )"
        );

        foreach ($data as $key => $interface) {
            $interface_id = self::get_or_insert_interface_id (
                $machine_id,
                $interface['name'],
                $interface['ifweight']
            );

            $data = [
                $machine_id,
                $interface_id,
                $timestamp,
                $interface['in_bytes'],
                $interface['in_unicast_packets'],
                $interface['in_not_unicast_packets'],
                $interface['out_bytes'],
                $interface['out_unicast_packets'],
                $interface['out_not_unicast_packets'],
                $interface['operationStatus'],
                $interface['adminStatus']
            ];
            $sth->execute($data);
        }
    }

    static function get_devices() {
        $dbh = self::getPDO();
        $sth = $dbh->query(
            "SELECT
		`id`,
		`machine_name`
	    FROM `machine`
	    ORDER BY `machine_name` ASC"
        );
        return $sth->fetchAll(PDO::FETCH_ASSOC);
    }

    static function get_interfaces($machine_id) {
        $dbh = self::getPDO();
        $sth = $dbh->prepare(
            "SELECT
                `id`,
                `interface_name`
            FROM `interface`
            WHERE `machine_id` = ?
            ORDER BY `if_weight` ASC"
        );
        $sth->execute([$machine_id]);
        return $sth->fetchAll(PDO::FETCH_ASSOC);
    }

    static function get_graph_data($machine_id, $interface_id) {
        $dbh = self::getPDO();
        $sth = $dbh->prepare(
            "SELECT
                UNIX_TIMESTAMP(`timestamp`) AS `timestamp`,
                `in_bytes`,
                `in_u_packets`,
                `in_nu_packets`,
                `out_bytes`,
                `out_u_packets`,
                `out_nu_packets`
            FROM `traffic`
            WHERE `machine_id` = ?
            AND `interface_id` = ?
            AND `timestamp` >= DATE_SUB(NOW(), INTERVAL 1 DAY)
	    LIMIT 1440"
        );
        $sth->execute([$machine_id, $interface_id]);
        $mysqlResult = $sth->fetchAll(PDO::FETCH_ASSOC);
        $deltaValuesArray = [];
        foreach ($mysqlResult as $mysqlValue) {
            $deltaValuesArray[$mysqlValue['timestamp']] = $mysqlValue;
            $prevValues = @$deltaValuesArray[$mysqlValue['timestamp'] - 60];
            $theseValues = $deltaValuesArray[$mysqlValue['timestamp']];
            if(null == $prevValues) {
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_in_bytes'] = 0;
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_in_u_packets'] = 0;
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_in_nu_packets'] = 0;
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_out_bytes'] = 0;
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_out_u_packets'] = 0;
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_out_nu_packets'] = 0;
            } else {
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_in_bytes'] =	max($theseValues['in_bytes'] - $prevValues['in_bytes'], 0);
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_in_u_packets'] = max($theseValues['in_u_packets'] - $prevValues['in_u_packets'], 0);
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_in_nu_packets'] = max($theseValues['in_nu_packets'] - $prevValues['in_nu_packets'], 0);
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_out_bytes'] = max($theseValues['out_bytes'] - $prevValues['out_bytes'],0);
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_out_u_packets'] = max($theseValues['out_u_packets'] - $prevValues['out_u_packets'], 0);
                $deltaValuesArray[$mysqlValue['timestamp']]['delta_out_nu_packets'] = max($theseValues['out_nu_packets'] - $prevValues['out_nu_packets'], 0);
            }
        }
        return $deltaValuesArray;
    }

    static function getPDO() {
	    global $config;
        if(null == self::$pdo) {
            self::$pdo = new PDO($config['dsn'], $config['user'], $config['password'], array( PDO::ATTR_PERSISTENT => false));;
        }
        return self::$pdo;
    }
}
